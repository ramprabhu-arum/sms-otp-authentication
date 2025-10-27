import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SessionService } from "../services/session.service";
import { v4 as uuidv4 } from "uuid";

const sessionService = new SessionService();

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

    const body = JSON.parse(event.body || "{}");
    const { appId, secret, phoneNumber } = body;

    // Validate required fields
    if (!appId || !secret || !phoneNumber) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: appId, secret, phoneNumber",
        }),
      };
    }

    // In production, validate appId and secret against a secure store
    // For now, we'll accept any non-empty values

    // Create a new session
    const sessionId = uuidv4();
    // HTTP API v2 uses requestContext.http.sourceIp
    const ipAddress =
      (event.requestContext as any)?.http?.sourceIp || "unknown";

    await sessionService.createSession({
      sessionId,
      phoneNumber,
      ipAddress,
      appId,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          sessionId,
          message: "QR validation successful. Session created.",
        },
      }),
    };
  } catch (error) {
    console.error("Error in validate-qr:", error);
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
