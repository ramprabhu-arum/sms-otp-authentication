// src/lambdas/verify-otp.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SessionStatus, AuditEventType, OTP_CONFIG } from "../types";
import { Logger } from "../utils/logger";
import { extractAPIContext, parseBody } from "../utils/api-context";
import {
  successResponse,
  badRequestResponse,
  forbiddenResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "../utils/lambda-response";
import { generateUUID } from "../utils/crypto";
import {
  validateSession,
  isMaxAttemptsExceeded,
  lockSession,
} from "../services/session.service";
import { verifyOTP } from "../services/otp.service";
import {
  updateSessionStatus,
  incrementSessionAttempts,
  logAuditEvent,
} from "../services/dynamodb.service";

const logger = new Logger({ lambda: "verify-otp" });

interface VerifyOTPRequest {
  sessionId: string;
  otp: string;
}

/**
 * Lambda handler for OTP verification
 * POST /verify-otp
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const context = extractAPIContext(event);
  logger.info("OTP verification request", { requestId: context.requestId });

  try {
    // Parse request body
    const body = parseBody<VerifyOTPRequest>(event);

    if (!body) {
      return badRequestResponse("Invalid request body");
    }

    const { sessionId, otp } = body;

    // Validate required fields
    if (!sessionId || !otp) {
      return badRequestResponse("Missing required fields: sessionId, otp");
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return badRequestResponse("Invalid OTP format. Must be 6 digits");
    }

    // Validate session
    const sessionValidation = await validateSession(sessionId);

    if (!sessionValidation.valid) {
      return forbiddenResponse(sessionValidation.reason || "Invalid session");
    }

    const session = sessionValidation.session!;

    // Check if max attempts exceeded
    if (isMaxAttemptsExceeded(session.attempts)) {
      logger.warn("Max OTP attempts exceeded", {
        sessionId,
        attempts: session.attempts,
      });

      await lockSession(
        sessionId,
        "Maximum OTP verification attempts exceeded"
      );

      await logAuditEvent({
        logId: generateUUID(),
        eventType: AuditEventType.SESSION_LOCKED,
        sessionId,
        phoneNumber: session.phoneNumber,
        appId: session.appId,
        ipAddress: context.sourceIp,
        timestamp: Date.now(),
        details: `Max attempts (${OTP_CONFIG.OTP_MAX_ATTEMPTS}) exceeded`,
        success: false,
      });

      return forbiddenResponse(
        "Maximum verification attempts exceeded. Session locked."
      );
    }

    // Verify OTP
    const verificationResult = await verifyOTP(sessionId, otp);

    if (!verificationResult.valid) {
      // Increment attempts
      const newAttempts = await incrementSessionAttempts(sessionId);

      logger.warn("OTP verification failed", {
        sessionId,
        reason: verificationResult.reason,
        attempts: newAttempts,
      });

      // Log failed attempt
      await logAuditEvent({
        logId: generateUUID(),
        eventType: AuditEventType.OTP_VERIFIED_FAILED,
        sessionId,
        phoneNumber: session.phoneNumber,
        appId: session.appId,
        ipAddress: context.sourceIp,
        timestamp: Date.now(),
        details: `Verification failed: ${verificationResult.reason}`,
        success: false,
      });

      // Check if should lock after this attempt
      if (isMaxAttemptsExceeded(newAttempts)) {
        await lockSession(
          sessionId,
          "Maximum OTP verification attempts exceeded"
        );
        return forbiddenResponse(
          "Maximum verification attempts exceeded. Session locked."
        );
      }

      return unauthorizedResponse(
        `Invalid OTP. ${OTP_CONFIG.OTP_MAX_ATTEMPTS - newAttempts} attempts remaining.`
      );
    }

    // OTP verified successfully
    await updateSessionStatus(sessionId, SessionStatus.VERIFIED);

    // Generate authentication token (JWT in production)
    const authToken = Buffer.from(
      JSON.stringify({
        sessionId,
        phoneNumber: session.phoneNumber,
        appId: session.appId,
        verifiedAt: Date.now(),
      })
    ).toString("base64");

    // Log successful verification
    await logAuditEvent({
      logId: generateUUID(),
      eventType: AuditEventType.OTP_VERIFIED_SUCCESS,
      sessionId,
      phoneNumber: session.phoneNumber,
      appId: session.appId,
      ipAddress: context.sourceIp,
      timestamp: Date.now(),
      details: "OTP verified successfully",
      success: true,
    });

    logger.info("OTP verified successfully", { sessionId });

    return successResponse(
      {
        sessionId,
        authToken,
        phoneNumber: session.phoneNumber,
        verifiedAt: Date.now(),
      },
      "OTP verified successfully"
    );
  } catch (error: any) {
    logger.error("Error verifying OTP", error);
    return serverErrorResponse();
  }
}
