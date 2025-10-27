import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SessionService } from "../services/session.service";
import { OTPService } from "../services/otp.service";
import { RateLimitService } from "../services/ratelimit.service";
import { SQSService } from "../services/sqs.service";
import { DebugLogger } from "../utils/debug-logger";

const sessionService = new SessionService();
const otpService = new OTPService();
const rateLimitService = new RateLimitService();
const sqsService = new SQSService();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const debugLog = new DebugLogger(
    "request-otp",
    event.requestContext.requestId
  );

  try {
    debugLog.logRequest("Received OTP request", {
      httpMethod: event.httpMethod,
      path: event.path,
      headers: event.headers,
    });

    // Handle preflight OPTIONS request
    if (event.httpMethod === "OPTIONS") {
      debugLog.logResponse("Handling OPTIONS preflight", { statusCode: 200 });
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { sessionId, phoneNumber } = body;
    const ipAddress =
      (event.requestContext as any)?.http?.sourceIp || "unknown";

    debugLog.logFlowStep(1, "Parse request body", {
      sessionId,
      phoneNumber,
      ipAddress,
    });

    // Validate required fields
    if (!sessionId || !phoneNumber) {
      debugLog.logError(
        "Missing required fields",
        new Error("Validation failed"),
        {
          sessionId,
          phoneNumber,
        }
      );
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: sessionId, phoneNumber",
        }),
      };
    }

    debugLog.logFlowStep(2, "Check rate limits");

    // Check rate limits
    debugLog.logServiceCall("RateLimitService", "checkRateLimit", {
      identifier: phoneNumber,
      type: "phone",
    });
    const phoneRateLimit = await rateLimitService.checkRateLimit(
      phoneNumber,
      "phone"
    );
    debugLog.logServiceResponse(
      "RateLimitService",
      "checkRateLimit",
      phoneRateLimit
    );

    if (!phoneRateLimit.allowed) {
      debugLog.logError("Phone rate limit exceeded", new Error("Rate limit"), {
        phoneNumber,
        retryAfter: phoneRateLimit.retryAfter,
      });
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Rate limit exceeded for phone number",
          retryAfter: phoneRateLimit.retryAfter,
        }),
      };
    }

    debugLog.logServiceCall("RateLimitService", "checkRateLimit", {
      identifier: ipAddress,
      type: "ip",
    });
    const ipRateLimit = await rateLimitService.checkRateLimit(ipAddress, "ip");
    debugLog.logServiceResponse(
      "RateLimitService",
      "checkRateLimit",
      ipRateLimit
    );

    if (!ipRateLimit.allowed) {
      debugLog.logError("IP rate limit exceeded", new Error("Rate limit"), {
        ipAddress,
        retryAfter: ipRateLimit.retryAfter,
      });
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Rate limit exceeded for IP address",
          retryAfter: ipRateLimit.retryAfter,
        }),
      };
    }

    debugLog.logFlowStep(3, "Verify session exists");

    // Verify session exists and is valid
    debugLog.logServiceCall("SessionService", "getSession", { sessionId });
    const session = await sessionService.getSession(sessionId);
    debugLog.logServiceResponse("SessionService", "getSession", {
      found: !!session,
      phoneNumberMatch: session?.phoneNumber === phoneNumber,
    });

    if (!session || session.phoneNumber !== phoneNumber) {
      debugLog.logError(
        "Invalid session or phone mismatch",
        new Error("Session validation failed"),
        {
          sessionFound: !!session,
          sessionPhoneNumber: session?.phoneNumber,
          requestPhoneNumber: phoneNumber,
        }
      );
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Invalid session or phone number mismatch",
        }),
      };
    }

    debugLog.logFlowStep(4, "Generate OTP");

    // Generate OTP
    const otp = otpService.generateOTP();
    debugLog.logData("OTP generated", {
      otp, // Will show actual OTP in debug mode
      otpLength: otp.length,
      otpType: typeof otp,
    });

    // DEMO MODE: Store OTP in session for easy retrieval (only when DEBUG_LOGGING is enabled)
    if (process.env.DEBUG_LOGGING === "true") {
      await sessionService.updateSessionWithDemoOTP(sessionId, otp);
    }

    debugLog.logFlowStep(5, "Store OTP in DynamoDB");

    // Store OTP
    debugLog.logServiceCall("OTPService", "storeOTP", {
      sessionId,
      phoneNumber,
      otpProvided: !!otp,
      otpValue: otp, // Show actual value for debugging
    });
    await otpService.storeOTP(sessionId, phoneNumber, otp);
    debugLog.logServiceResponse("OTPService", "storeOTP", { success: true });

    debugLog.logFlowStep(6, "Increment rate limit counters");

    // Increment rate limit counters
    await rateLimitService.incrementRateLimit(phoneNumber, "phone");
    await rateLimitService.incrementRateLimit(ipAddress, "ip");
    debugLog.logData("Rate limits incremented", { phoneNumber, ipAddress });

    debugLog.logFlowStep(7, "Send SMS via SQS");

    // Send SMS via SQS
    const sqsMessage = {
      phoneNumber,
      otp, // ✅ FIXED: Sending OTP value
      sessionId,
    };

    debugLog.logSQSSend("sms-delivery-queue", sqsMessage);
    debugLog.logData("SQS Message being sent", {
      messageContent: sqsMessage,
      otpIncluded: !!sqsMessage.otp,
      otpValue: sqsMessage.otp, // Show actual value for debugging
      otpType: typeof sqsMessage.otp,
    });

    await sqsService.sendSMSMessage(sqsMessage);
    debugLog.logServiceResponse("SQSService", "sendSMSMessage", {
      success: true,
    });

    debugLog.logFlowStep(8, "Return success response");

    const response = {
      success: true,
      data: {
        message: "OTP sent successfully",
        expiresIn: 300, // 5 minutes in seconds
      },
    };

    debugLog.logResponse("OTP request completed successfully", response);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    debugLog.logError("Error in request-otp handler", error, {
      errorMessage: error?.message,
      errorStack: error?.stack,
    });

    console.error("Error in request-otp:", error);
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
