// src/lambdas/sms-sender.ts
import { SQSEvent, SQSRecord } from "aws-lambda";
import { Logger } from "../utils/logger";
import { sendSMS } from "../services/sms.service";

const logger = new Logger({ lambda: "sms-sender" });

interface SMSMessage {
  phoneNumber: string;
  otp: string;
  sessionId: string;
  otpId: string;
}

/**
 * Process a single SQS message
 */
async function processSMSMessage(record: SQSRecord): Promise<void> {
  try {
    const message: SMSMessage = JSON.parse(record.body);
    const { phoneNumber, otp, sessionId, otpId } = message;

    logger.info("Processing SMS message", { sessionId, phoneNumber });

    // Send SMS via Twilio
    const result = await sendSMS(phoneNumber, otp, otpId);

    if (result.success) {
      logger.info("SMS sent successfully", {
        sessionId,
        phoneNumber,
        messageId: result.messageId,
      });
    } else {
      logger.error("Failed to send SMS", new Error(result.error), {
        sessionId,
        phoneNumber,
      });
      // Throw error to trigger SQS retry
      throw new Error(`SMS delivery failed: ${result.error}`);
    }
  } catch (error: any) {
    logger.error("Error processing SMS message", error);
    throw error; // Re-throw to trigger SQS retry/DLQ
  }
}

/**
 * Lambda handler for SQS SMS delivery
 * Triggered by SQS queue
 */
export async function handler(event: SQSEvent): Promise<void> {
  logger.info("SMS sender invoked", { recordCount: event.Records.length });

  // Process messages in parallel
  const promises = event.Records.map((record) => processSMSMessage(record));

  await Promise.all(promises);

  logger.info("All SMS messages processed");
}
