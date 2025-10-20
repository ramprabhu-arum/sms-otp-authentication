import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "../utils/logger";
import { updateOTPDeliveryStatus } from "../services/dynamodb.service";

const logger = new Logger({ lambda: "twilio-webhook" });

/**
 * Twilio Status Callback Webhook
 * Called by Twilio when SMS status changes
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    logger.info("Twilio webhook received", {
      body: event.body,
    });

    const params = new URLSearchParams(event.body || "");

    const messageSid = params.get("MessageSid");
    const messageStatus = params.get("MessageStatus");
    const errorCode = params.get("ErrorCode");
    const errorMessage = params.get("ErrorMessage");
    const to = params.get("To");

    logger.info("Twilio status update", {
      messageSid,
      messageStatus,
      errorCode,
      errorMessage,
      to,
    });

    if (messageSid) {
      await updateOTPDeliveryStatus(messageSid, {
        status: messageStatus || "unknown",
        errorCode: errorCode || undefined,
        errorMessage: errorMessage || undefined,
        updatedAt: new Date(),
      });

      logger.info("Delivery status updated", {
        messageSid,
        status: messageStatus,
      });

      if (messageStatus === "failed" || messageStatus === "undelivered") {
        logger.error(
          "SMS delivery failed",
          new Error(`SMS failed: ${errorMessage}`)
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: any) {
    logger.error("Webhook processing error", error);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
}
