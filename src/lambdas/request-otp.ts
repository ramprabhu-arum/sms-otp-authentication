// src/lambdas/request-otp.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SessionStatus, AuditEventType } from "../types";
import { Logger } from "../utils/logger";
import { extractAPIContext, parseBody } from "../utils/api-context";
import {
  successResponse,
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse,
} from "../utils/lambda-response";
import { validatePhoneNumber, generateUUID } from "../utils/crypto";
import {
  validateSession,
  validatePhoneBinding,
  lockSession,
} from "../services/session.service";
import { generateAndStoreOTP } from "../services/otp.service";
import {
  updateSessionStatus,
  incrementSessionAttempts,
  logAuditEvent,
} from "../services/dynamodb.service";

const logger = new Logger({ lambda: "request-otp" });

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const SMS_QUEUE_URL = process.env.SQS_SMS_DELIVERY_URL!;

interface RequestOTPRequest {
  sessionId: string;
  phoneNumber: string;
}

/**
 * Lambda handler for OTP request
 * POST /request-otp
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const context = extractAPIContext(event);
  logger.info("OTP request", { requestId: context.requestId });

  try {
    // Parse request body
    const body = parseBody<RequestOTPRequest>(event);

    if (!body) {
      return badRequestResponse("Invalid request body");
    }

    const { sessionId, phoneNumber } = body;

    // Validate required fields
    if (!sessionId || !phoneNumber) {
      return badRequestResponse(
        "Missing required fields: sessionId, phoneNumber"
      );
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return badRequestResponse("Invalid phone number format");
    }

    // Validate session
    const sessionValidation = await validateSession(sessionId);

    if (!sessionValidation.valid) {
      return forbiddenResponse(sessionValidation.reason || "Invalid session");
    }

    const session = sessionValidation.session!;

    // CRITICAL: Validate phone number binding (fraud prevention)
    if (!validatePhoneBinding(session, phoneNumber)) {
      logger.warn("Phone number mismatch - fraud detected", {
        sessionId,
        expectedPhone: session.phoneNumber,
        providedPhone: phoneNumber,
      });

      // Lock session
      await lockSession(sessionId, "Phone number mismatch detected");

      // Log fraud event
      await logAuditEvent({
        logId: generateUUID(),
        eventType: AuditEventType.FRAUD_DETECTED,
        sessionId,
        phoneNumber,
        appId: session.appId,
        ipAddress: context.sourceIp,
        timestamp: Date.now(),
        details: `Phone mismatch: expected ${session.phoneNumber}, got ${phoneNumber}`,
        success: false,
      });

      return forbiddenResponse("Session locked due to security violation");
    }

    // Generate OTP
    const { otp, otpId } = await generateAndStoreOTP(sessionId);
    // Update session status
    await updateSessionStatus(sessionId, SessionStatus.OTP_GENERATED);

    // Send SMS via SQS (async)
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: SMS_QUEUE_URL,
        MessageBody: JSON.stringify({
          phoneNumber,
          otp,
          sessionId,
          otpId,
        }),
      })
    );

    // Log audit event
    await logAuditEvent({
      logId: generateUUID(),
      eventType: AuditEventType.OTP_REQUESTED,
      sessionId,
      phoneNumber,
      appId: session.appId,
      ipAddress: context.sourceIp,
      timestamp: Date.now(),
      details: "OTP generated and queued for delivery",
      success: true,
    });

    logger.info("OTP generated and queued", { sessionId });

    return successResponse(
      {
        sessionId,
        message: "OTP sent to your phone number",
      },
      "OTP request successful"
    );
  } catch (error: any) {
    logger.error("Error requesting OTP", error);
    return serverErrorResponse();
  }
}
