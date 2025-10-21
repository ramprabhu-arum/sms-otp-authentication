import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { OTPService } from "../services/otp.service";
import { SessionService } from "../services/session.service";
import { v4 as uuidv4 } from "uuid";

const otpService = new OTPService();
const sessionService = new SessionService();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const handler = async (
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
    const { sessionId, otp } = body;

    // Validate required fields
    if (!sessionId || !otp) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: sessionId, otp",
        }),
      };
    }

    // Verify OTP
    const isValid = await otpService.verifyOTP(sessionId, otp);

    if (!isValid) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Invalid or expired OTP",
        }),
      };
    }

    // Generate auth token (in production, use JWT)
    const authToken = uuidv4();

    // Update session as verified
    await sessionService.markSessionAsVerified(sessionId, authToken);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          authToken,
          message: "OTP verified successfully",
        },
      }),
    };
  } catch (error) {
    console.error("Error in verify-otp:", error);
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
