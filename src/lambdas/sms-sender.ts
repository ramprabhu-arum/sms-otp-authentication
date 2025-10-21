// src/lambdas/sms-sender.ts
import { SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "../utils/logger";
import { DebugLogger } from "../utils/debug-logger";
import { sendSMS } from "../services/sms.service";

const logger = new Logger({ lambda: "sms-sender" });

// Support BOTH formats for compatibility
interface SMSMessage {
  phoneNumber: string;
  otp?: string; // New format: just the OTP code
  message?: string; // Old format: full message text
  sessionId: string;
}

/**
 * Process a single SQS message
 */
async function processSMSMessage(record: SQSRecord): Promise<void> {
  const debugLog = new DebugLogger("sms-sender", record.messageId);

  try {
    debugLog.logSQSReceive("sms-delivery-queue", record.body);

    const sqsMessage: SMSMessage = JSON.parse(record.body);
    const { phoneNumber, otp, message, sessionId } = sqsMessage;

    debugLog.logFlowStep(1, "Parse SQS message", {
      phoneNumber,
      sessionId,
      hasOTP: !!otp,
      hasMessage: !!message,
      otpValue: otp,
      messagePreview: message?.substring(0, 50),
      receivedKeys: Object.keys(sqsMessage),
    });

    // ✅ CRITICAL: Determine SMS text from either format
    let smsText: string;

    if (message) {
      // Old format: full message text provided
      smsText = message;
      debugLog.logFlowStep(2, "Using provided message text", {
        messageLength: smsText.length,
        messagePreview: smsText.substring(0, 50),
      });
    } else if (otp) {
      // New format: OTP code provided, format the message
      smsText = `Your OTP code is: ${otp}. Valid for 5 minutes.`;
      debugLog.logFlowStep(2, "Format SMS message from OTP", {
        otp,
        messageTemplate: smsText,
      });
    } else {
      // Neither provided - permanent error, don't retry
      debugLog.logError(
        "Neither OTP nor message provided - NOT RETRYING",
        new Error("Missing OTP and message"),
        {
          sqsMessage,
          phoneNumber,
          sessionId,
          receivedKeys: Object.keys(sqsMessage),
        }
      );
      logger.error(
        "Invalid SQS message format - skipping",
        new Error("Missing OTP and message"),
        {
          sessionId,
          phoneNumber,
        }
      );
      // DON'T throw - this is a permanent error, no point retrying
      return;
    }

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== "string") {
      debugLog.logError(
        "Invalid phone number - NOT RETRYING",
        new Error("Invalid phone number"),
        {
          phoneNumber,
          phoneNumberType: typeof phoneNumber,
        }
      );
      logger.error(
        "Invalid phone number - skipping",
        new Error("Invalid phone number"),
        {
          sessionId,
          phoneNumber,
        }
      );
      return;
    }

    // Validate SMS text
    if (!smsText || typeof smsText !== "string" || smsText.length === 0) {
      debugLog.logError(
        "Invalid SMS text - NOT RETRYING",
        new Error("Invalid SMS text"),
        {
          smsText,
          smsTextType: typeof smsText,
        }
      );
      logger.error(
        "Invalid SMS text - skipping",
        new Error("Invalid SMS text"),
        {
          sessionId,
          phoneNumber,
        }
      );
      return;
    }

    logger.info("Processing SMS message", { sessionId, phoneNumber });

    debugLog.logData("SMS text ready to send", {
      smsText,
      textLength: smsText.length,
      containsOTP: otp ? smsText.includes(otp) : "N/A",
    });

    debugLog.logFlowStep(3, "Send SMS via Twilio");

    // Send SMS via Twilio
    debugLog.logServiceCall("Twilio", "sendSMS", {
      phoneNumber,
      messageLength: smsText.length,
      messagePreview: smsText.substring(0, 50),
    });

    const result = await sendSMS(phoneNumber, smsText);

    debugLog.logServiceResponse("Twilio", "sendSMS", {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });

    if (result.success) {
      logger.info("SMS sent successfully", {
        sessionId,
        phoneNumber,
        messageId: result.messageId,
      });
      debugLog.logFlowStep(4, "SMS sent successfully", {
        twilioSid: result.messageId,
      });
    } else {
      // Check if error is permanent or temporary
      const permanentErrors = [
        "invalid phone number",
        "unverified number",
        "invalid credentials",
        "account suspended",
        "invalid to",
        "invalid from",
        "phone number is not verified",
        "not a valid phone number",
      ];

      const isPermanent = permanentErrors.some((err) =>
        result.error?.toLowerCase().includes(err)
      );

      if (isPermanent) {
        // Permanent error - don't retry
        logger.error(
          "Permanent Twilio error - NOT RETRYING",
          new Error(result.error),
          {
            sessionId,
            phoneNumber,
            errorType: "PERMANENT",
          }
        );
        debugLog.logError(
          "Permanent Twilio error - NOT RETRYING",
          new Error(result.error || "Unknown error"),
          {
            sessionId,
            phoneNumber,
            error: result.error,
            errorType: "PERMANENT",
          }
        );
        // DON'T throw - permanent error, no point retrying
        return;
      } else {
        // Temporary error - retry
        logger.error(
          "Temporary Twilio error - WILL RETRY",
          new Error(result.error),
          {
            sessionId,
            phoneNumber,
            errorType: "TEMPORARY",
          }
        );
        debugLog.logError(
          "Temporary Twilio error - WILL RETRY",
          new Error(result.error || "Unknown error"),
          {
            sessionId,
            phoneNumber,
            error: result.error,
            errorType: "TEMPORARY",
          }
        );
        // Throw error to trigger SQS retry
        throw new Error(`SMS delivery failed (temporary): ${result.error}`);
      }
    }
  } catch (error: any) {
    // Only log and re-throw if we haven't already handled it
    if (!error.message?.includes("SMS delivery failed")) {
      logger.error("Error processing SMS message", error);
      const debugLog2 = new DebugLogger("sms-sender");
      debugLog2.logError("Fatal error in processSMSMessage", error, {
        recordBody: record.body,
        errorMessage: error?.message,
        errorStack: error?.stack,
      });
    }
    throw error; // Re-throw to trigger SQS retry/DLQ
  }
}

/**
 * Lambda handler for SQS SMS delivery
 * Triggered by SQS queue
 */
export async function handler(event: SQSEvent): Promise<void> {
  const debugLog = new DebugLogger("sms-sender");

  debugLog.logRequest("SMS sender Lambda invoked", {
    recordCount: event.Records.length,
    records: event.Records.map((r) => ({
      messageId: r.messageId,
      bodyPreview: r.body.substring(0, 100),
    })),
  });

  logger.info("SMS sender invoked", { recordCount: event.Records.length });

  // Process messages with error handling
  const results = await Promise.allSettled(
    event.Records.map((record) => processSMSMessage(record))
  );

  // Count results
  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  logger.info("SMS processing complete", {
    total: event.Records.length,
    successful,
    failed,
  });

  debugLog.logResponse("SMS processing complete", {
    processedCount: event.Records.length,
    successful,
    failed,
  });

  // If any failed with temporary errors, throw to trigger batch retry
  if (failed > 0) {
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason.message);

    logger.error(
      "Some messages failed processing",
      new Error(errors.join("; ")),
      {
        failedCount: failed,
      }
    );

    throw new Error(
      `Failed to process ${failed} messages: ${errors.join(", ")}`
    );
  }
}
