// src/services/dynamodb.service.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  Session,
  OTPRecord,
  RateLimit,
  AuditLog,
  SessionStatus,
} from "../types";
import { Logger } from "../utils/logger";

const logger = new Logger({ service: "DynamoDBService" });

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(client);

// Table names from environment variables
const TABLES = {
  SESSIONS: process.env.DYNAMODB_SESSIONS_TABLE || "sms-otp-sessions",
  OTP_RECORDS: process.env.DYNAMODB_OTP_RECORDS_TABLE || "sms-otp-records",
  RATE_LIMITS: process.env.DYNAMODB_RATE_LIMITS_TABLE || "sms-otp-rate-limits",
  AUDIT_LOGS: process.env.DYNAMODB_AUDIT_LOGS_TABLE || "sms-otp-audit-logs",
};

/**
 * Session Management
 */
export async function createSession(session: Session): Promise<Session> {
  logger.info("Creating session", { sessionId: session.sessionId });

  await docClient.send(
    new PutCommand({
      TableName: TABLES.SESSIONS,
      Item: session,
    })
  );

  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  logger.debug("Getting session", { sessionId });

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.SESSIONS,
      Key: { sessionId },
    })
  );

  return (result.Item as Session) || null;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  additionalFields?: Partial<Session>
): Promise<void> {
  logger.info("Updating session status", { sessionId, status });

  const updateExpression: string[] = [
    "#status = :status",
    "#lastActivityAt = :lastActivityAt",
  ];
  const expressionAttributeNames: Record<string, string> = {
    "#status": "status",
    "#lastActivityAt": "lastActivityAt",
  };
  const expressionAttributeValues: Record<string, any> = {
    ":status": status,
    ":lastActivityAt": Date.now(),
  };

  // Add optional fields
  if (additionalFields) {
    Object.entries(additionalFields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.SESSIONS,
      Key: { sessionId },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

export async function incrementSessionAttempts(
  sessionId: string
): Promise<number> {
  logger.info("Incrementing session attempts", { sessionId });

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLES.SESSIONS,
      Key: { sessionId },
      UpdateExpression: "ADD attempts :inc SET lastActivityAt = :now",
      ExpressionAttributeValues: {
        ":inc": 1,
        ":now": Date.now(),
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return (result.Attributes?.attempts as number) || 0;
}

/**
 * OTP Management
 */
export async function storeOTP(otp: OTPRecord): Promise<OTPRecord> {
  logger.info("Storing OTP", { otpId: otp.otpId, sessionId: otp.sessionId });

  await docClient.send(
    new PutCommand({
      TableName: TABLES.OTP_RECORDS,
      Item: otp,
    })
  );

  return otp;
}

export async function getOTPBySession(
  sessionId: string
): Promise<OTPRecord | null> {
  logger.debug("Getting OTP by session", { sessionId });

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.OTP_RECORDS,
      IndexName: "sessionId-index",
      KeyConditionExpression: "sessionId = :sessionId",
      FilterExpression: "verified = :verified",
      ExpressionAttributeValues: {
        ":sessionId": sessionId,
        ":verified": false,
      },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  return (result.Items?.[0] as OTPRecord) || null;
}

export async function markOTPVerified(otpId: string): Promise<void> {
  logger.info("Marking OTP as verified", { otpId });

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.OTP_RECORDS,
      Key: { otpId },
      UpdateExpression: "SET verified = :verified",
      ExpressionAttributeValues: {
        ":verified": true,
      },
    })
  );
}

/**
 * Rate Limiting
 */
export async function getRateLimit(
  identifier: string
): Promise<RateLimit | null> {
  logger.debug("Getting rate limit", { identifier });

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.RATE_LIMITS,
      Key: { identifier },
    })
  );

  return (result.Item as RateLimit) || null;
}

export async function upsertRateLimit(rateLimit: RateLimit): Promise<void> {
  logger.debug("Upserting rate limit", { identifier: rateLimit.identifier });

  await docClient.send(
    new PutCommand({
      TableName: TABLES.RATE_LIMITS,
      Item: rateLimit,
    })
  );
}

/**
 * Audit Logging
 */
export async function logAuditEvent(log: AuditLog): Promise<void> {
  logger.info("Logging audit event", {
    eventType: log.eventType,
    sessionId: log.sessionId,
  });

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.AUDIT_LOGS,
        Item: log,
      })
    );
  } catch (error) {
    logger.error("Failed to log audit event", error as Error, { log });
    // Don't throw - audit logging should not break main flow
  }
}

export async function updateOTPWithTwilioSid(
  otpId: string,
  twilioMessageSid: string
): Promise<void> {
  const params = {
    TableName: TABLES.OTP_RECORDS,
    Key: {
      otpId,
    },
    UpdateExpression:
      "SET twilioMessageSid = :sid, deliveryStatus = :status, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":sid": twilioMessageSid,
      ":status": "queued",
      ":updatedAt": new Date().toISOString(),
    },
  };

  await docClient.send(new UpdateCommand(params));

  logger.info("OTP updated with Twilio message SID", {
    otpId,
    twilioMessageSid,
  });
}

/**
 * Update OTP delivery status from Twilio webhook
 */
export async function updateOTPDeliveryStatus(
  twilioMessageSid: string,
  status: {
    status: string;
    errorCode?: string;
    errorMessage?: string;
    updatedAt: Date;
  }
): Promise<void> {
  const queryParams = {
    TableName: TABLES.OTP_RECORDS,
    IndexName: "twilioMessageSid-index",
    KeyConditionExpression: "twilioMessageSid = :sid",
    ExpressionAttributeValues: {
      ":sid": twilioMessageSid,
    },
  };

  const result = await docClient.send(new QueryCommand(queryParams));

  if (result.Items && result.Items.length > 0) {
    const otpRecord = result.Items[0];

    const updateParams = {
      TableName: TABLES.OTP_RECORDS,
      Key: {
        otpId: otpRecord.otpId,
      },
      UpdateExpression:
        "SET deliveryStatus = :status, errorCode = :errorCode, errorMessage = :errorMessage, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":status": status.status,
        ":errorCode": status.errorCode || null,
        ":errorMessage": status.errorMessage || null,
        ":updatedAt": status.updatedAt.toISOString(),
      },
    };

    await docClient.send(new UpdateCommand(updateParams));

    logger.info("OTP delivery status updated", {
      otpId: otpRecord.otpId,
      twilioMessageSid,
      status: status.status,
    });
  } else {
    logger.warn("OTP record not found for Twilio message", {
      twilioMessageSid,
    });
  }
}
