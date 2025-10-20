// src/lambdas/validate-qr.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { OTP_CONFIG, AuditEventType } from "../types";
import { Logger } from "../utils/logger";
import { extractAPIContext, parseBody } from "../utils/api-context";
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  serverErrorResponse,
  rateLimitResponse,
} from "../utils/lambda-response";
import { validatePhoneNumber } from "../utils/crypto";
import { createAuthSession } from "../services/session.service";
import {
  checkIPRateLimit,
  checkPhoneRateLimit,
} from "../services/ratelimit.service";
import { logAuditEvent } from "../services/dynamodb.service";
import { generateUUID } from "../utils/crypto";

const logger = new Logger({ lambda: "validate-qr" });

interface ValidateQRRequest {
  appId: string;
  secret: string;
  phoneNumber: string;
  clientSessionId?: string;
}

/**
 * Lambda handler for QR validation
 * POST /validate-qr
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const context = extractAPIContext(event);
  logger.info("QR validation request", { requestId: context.requestId });

  try {
    // Parse request body
    const body = parseBody<ValidateQRRequest>(event);

    if (!body) {
      return badRequestResponse("Invalid request body");
    }

    const { appId, secret, phoneNumber, clientSessionId } = body;

    // Validate required fields
    if (!appId || !secret || !phoneNumber) {
      return badRequestResponse(
        "Missing required fields: appId, secret, phoneNumber"
      );
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return badRequestResponse(
        "Invalid phone number format. Use E.164 format (e.g., +1234567890)"
      );
    }

    // Check rate limits
    const ipRateLimit = await checkIPRateLimit(context.sourceIp);
    if (ipRateLimit.limited) {
      await logAuditEvent({
        logId: generateUUID(),
        eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
        phoneNumber,
        appId,
        ipAddress: context.sourceIp,
        timestamp: Date.now(),
        details: "IP rate limit exceeded",
        success: false,
      });
      return rateLimitResponse(ipRateLimit.resetAt);
    }

    const phoneRateLimit = await checkPhoneRateLimit(phoneNumber);
    if (phoneRateLimit.limited) {
      await logAuditEvent({
        logId: generateUUID(),
        eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
        phoneNumber,
        appId,
        ipAddress: context.sourceIp,
        timestamp: Date.now(),
        details: "Phone rate limit exceeded",
        success: false,
      });
      return rateLimitResponse(phoneRateLimit.resetAt);
    }

    // Validate static QR secret
    if (
      appId !== OTP_CONFIG.STATIC_QR_APP_ID ||
      secret !== OTP_CONFIG.STATIC_QR_SECRET
    ) {
      logger.warn("Invalid QR credentials", { appId });
      await logAuditEvent({
        logId: generateUUID(),
        eventType: AuditEventType.QR_VALIDATED,
        phoneNumber,
        appId,
        ipAddress: context.sourceIp,
        timestamp: Date.now(),
        details: "Invalid QR credentials",
        success: false,
      });
      return unauthorizedResponse("Invalid QR code credentials");
    }

    // Create authentication session
    const session = await createAuthSession(
      phoneNumber,
      appId,
      clientSessionId
    );

    // Log audit event
    await logAuditEvent({
      logId: generateUUID(),
      eventType: AuditEventType.QR_VALIDATED,
      sessionId: session.sessionId,
      phoneNumber,
      appId,
      ipAddress: context.sourceIp,
      timestamp: Date.now(),
      details: "QR validated successfully",
      success: true,
    });

    logger.info("QR validated successfully", { sessionId: session.sessionId });

    return successResponse(
      {
        sessionId: session.sessionId,
        expiresAt: session.expiryAt,
      },
      "QR code validated successfully"
    );
  } catch (error: any) {
    logger.error("Error validating QR", error);
    return serverErrorResponse();
  }
}
