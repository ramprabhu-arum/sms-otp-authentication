import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "../services/dynamodb.service";

const dynamoDBService = new DynamoDBService();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Handle preflight OPTIONS request
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    console.log("Twilio webhook received:", JSON.stringify(event.body));

    // Parse Twilio's form-encoded webhook data
    const params = new URLSearchParams(event.body || "");
    const messageSid = params.get("MessageSid");
    const messageStatus = params.get("MessageStatus");
    const to = params.get("To");
    const from = params.get("From");
    const errorCode = params.get("ErrorCode");

    if (!messageSid || !messageStatus) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Missing required Twilio parameters",
        }),
      };
    }

    // Log the delivery status to audit logs
    await dynamoDBService.logAuditEvent({
      eventType: "SMS_DELIVERY_STATUS",
      messageSid,
      status: messageStatus,
      to: to || "",
      from: from || "",
      errorCode: errorCode || undefined,
      timestamp: new Date().toISOString(),
    });

    console.log(`SMS ${messageSid} status: ${messageStatus}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
      }),
    };
  } catch (error) {
    console.error("Error in twilio-webhook:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
    };
  }
};
