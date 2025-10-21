import { SQSEvent } from "aws-lambda";
import twilio from "twilio";
import { DebugLogger } from "../utils/debug-logger";
import { updateOTPWithTwilioSid } from "./dynamodb.service";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  throw new Error("Missing required Twilio environment variables");
}

const twilioClient = twilio(accountSid, authToken);

export interface SMSMessage {
  phoneNumber: string;
  otp: string; // ✅ Changed from 'message' to 'otp'
  sessionId: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ✅ FIXED: Updated function signature to accept message text directly
export async function sendSMS(
  phoneNumber: string,
  messageText: string // ✅ Changed from 'otp' and 'otpId' to just 'messageText'
): Promise<SMSResult> {
  const debugLog = new DebugLogger("sms.service");

  try {
    debugLog.logFlowStep(1, "Prepare Twilio API call", {
      phoneNumber,
      messageText,
      messageLength: messageText.length,
      fromNumber,
      containsOTP: /\d{6}/.test(messageText),
    });

    // ✅ CRITICAL CHECK: Verify message text is not undefined
    if (!messageText || messageText.includes("undefined")) {
      debugLog.logError(
        "Message text is invalid!",
        new Error("Invalid message"),
        {
          messageText,
          phoneNumber,
        }
      );
      throw new Error(`Invalid message text: ${messageText}`);
    }

    debugLog.logServiceCall("Twilio", "messages.create", {
      body: messageText,
      from: fromNumber,
      to: phoneNumber,
      statusCallback: process.env.TWILIO_WEBHOOK_URL,
    });

    const result = await twilioClient.messages.create({
      body: messageText,
      from: fromNumber,
      to: phoneNumber,
      statusCallback: process.env.TWILIO_WEBHOOK_URL,
    });

    debugLog.logServiceResponse("Twilio", "messages.create", {
      sid: result.sid,
      status: result.status,
      to: result.to,
      from: result.from,
    });

    console.log(`SMS sent successfully. SID: ${result.sid}`);

    debugLog.logFlowStep(2, "SMS sent successfully", {
      twilioSid: result.sid,
      status: result.status,
    });

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    debugLog.logError("Twilio API error", error, {
      phoneNumber,
      messageText,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorDetails: error?.moreInfo,
    });
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// Class-based service (for future use)
export class SMSService {
  async sendSMS(
    phoneNumber: string,
    message: string,
    sessionId?: string
  ): Promise<string> {
    const debugLog = new DebugLogger("SMSService");

    try {
      debugLog.logServiceCall("Twilio", "messages.create", {
        phoneNumber,
        messageLength: message.length,
        sessionId,
      });

      const result = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: phoneNumber,
        statusCallback: process.env.TWILIO_WEBHOOK_URL,
      });

      debugLog.logServiceResponse("Twilio", "messages.create", {
        sid: result.sid,
        status: result.status,
      });

      console.log(`SMS sent successfully. SID: ${result.sid}`);

      if (sessionId) {
        await updateOTPWithTwilioSid(sessionId, result.sid);
      }

      return result.sid;
    } catch (error: any) {
      console.error("Error sending SMS:", error);
      debugLog.logError("SMS send error", error);
      throw error;
    }
  }

  async processSQSMessages(event: SQSEvent): Promise<void> {
    const debugLog = new DebugLogger("SMSService.processSQSMessages");

    for (const record of event.Records) {
      try {
        debugLog.logSQSReceive("sms-queue", record.body);

        const message: SMSMessage = JSON.parse(record.body);

        debugLog.logData("Processing SQS message", {
          phoneNumber: message.phoneNumber,
          otp: message.otp,
          sessionId: message.sessionId,
        });

        // Format the message with OTP
        const smsText = `Your OTP code is: ${message.otp}. Valid for 5 minutes.`;

        await this.sendSMS(message.phoneNumber, smsText, message.sessionId);
      } catch (error: any) {
        console.error("Error processing SQS message:", error);
        debugLog.logError("SQS message processing error", error);
        throw error;
      }
    }
  }
}
