import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
});
const docClient = DynamoDBDocumentClient.from(client);

const AUDIT_LOGS_TABLE = process.env.AUDIT_LOGS_TABLE || "sms-otp-audit-logs";
const RECORDS_TABLE = process.env.RECORDS_TABLE || "sms-otp-records";

export interface AuditEvent {
  eventType: string;
  messageSid?: string;
  status?: string;
  to?: string;
  from?: string;
  errorCode?: string;
  timestamp: string;
  [key: string]: any;
}

export class DynamoDBService {
  async logAuditEvent(event: AuditEvent): Promise<void> {
    const command = new PutCommand({
      TableName: AUDIT_LOGS_TABLE,
      Item: {
        eventId: uuidv4(),
        ...event,
        ttl: Math.floor(Date.now() / 1000) + 2592000, // 30 days
      },
    });

    await docClient.send(command);
  }
}

// Standalone function for updating OTP records with Twilio SID
export async function updateOTPWithTwilioSid(
  sessionId: string,
  twilioSid: string
): Promise<void> {
  const command = new UpdateCommand({
    TableName: RECORDS_TABLE,
    Key: { sessionId },
    UpdateExpression: "SET twilioSid = :twilioSid, smsSentAt = :smsSentAt",
    ExpressionAttributeValues: {
      ":twilioSid": twilioSid,
      ":smsSentAt": new Date().toISOString(),
    },
  });

  await docClient.send(command);
}
