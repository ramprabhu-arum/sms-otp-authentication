// src/services/sms.service.ts
import twilio from "twilio";
import { Logger } from "../utils/logger";
import { updateOTPWithTwilioSid } from "./dynamodb.service";

const logger = new Logger({ service: "SMSService" });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export interface SMSResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Send SMS via Twilio with proper error handling
 */
export async function sendSMS(
  phoneNumber: string,
  otp: string,
  otpId: string
): Promise<SMSResult> {
  try {
    logger.info("Sending SMS", { phoneNumber });

    const message = await twilioClient.messages.create({
      body: `Your verification code is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    await updateOTPWithTwilioSid(otpId, message.sid);

    // Check Twilio response status
    logger.info("Twilio response received", {
      messageId: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    });

    // Twilio statuses: queued, sending, sent, delivered, failed, undelivered
    if (message.status === "failed" || message.status === "undelivered") {
      logger.error(
        "SMS delivery failed",
        new Error(message.errorMessage || "Unknown error"),
        {
          messageId: message.sid,
          status: message.status,
          errorCode: message.errorCode,
          phoneNumber,
        }
      );

      return {
        success: false,
        messageId: message.sid,
        status: message.status,
        error: message.errorMessage || "SMS delivery failed",
        errorCode: message.errorCode?.toString(),
      };
    }

    // Status is queued, sending, or sent - consider it successful
    logger.info("SMS sent successfully", {
      phoneNumber,
      messageId: message.sid,
      status: message.status,
    });

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
    };
  } catch (error: any) {
    logger.error("Error sending SMS", error, { phoneNumber });

    // Extract Twilio error details
    const errorCode = error.code || error.status;
    const errorMessage = error.message || "Failed to send SMS";

    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode?.toString(),
    };
  }
}
