import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
});
const docClient = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "sms-otp-sessions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * GET /get-otp?sessionId={sessionId}
 *
 * Retrieves the actual OTP for demo/testing purposes.
 * The OTP is stored in the session table when DEBUG_LOGGING is enabled.
 *
 * This is a MINIMAL IMPACT solution - only reads from existing session table.
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Get OTP request:", JSON.stringify(event, null, 2));

    // Handle preflight OPTIONS request
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    // Get sessionId from query parameters
    const sessionId = event.queryStringParameters?.sessionId;

    if (!sessionId) {
      console.error("Missing sessionId parameter");
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Missing required parameter: sessionId",
        }),
      };
    }

    console.log("Retrieving session:", sessionId);

    // Get session from DynamoDB
    const command = new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
    });

    const result = await docClient.send(command);
    const session = result.Item;

    if (!session) {
      console.error("Session not found:", sessionId);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Session not found. It may have expired.",
        }),
      };
    }

    // Check if demoOTP is available
    if (!session.demoOTP) {
      console.error("Demo OTP not available for session:", sessionId);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error:
            "Demo OTP not available. This feature requires DEBUG_LOGGING to be enabled.",
        }),
      };
    }

    console.log("Demo OTP retrieved successfully for session:", sessionId);

    const response = {
      success: true,
      data: {
        otp: session.demoOTP,
        phoneNumber: session.phoneNumber,
        message: "OTP retrieved successfully (demo mode).",
      },
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error("Error in get-otp handler:", error);
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
