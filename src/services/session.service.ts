import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
});
const docClient = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "sms-otp-sessions";

export interface SessionData {
  sessionId: string;
  phoneNumber: string;
  ipAddress: string;
  appId: string;
  createdAt?: string;
  verified?: boolean;
  authToken?: string;
}

export class SessionService {
  async createSession(data: SessionData): Promise<void> {
    const command = new PutCommand({
      TableName: SESSIONS_TABLE,
      Item: {
        sessionId: data.sessionId,
        phoneNumber: data.phoneNumber,
        ipAddress: data.ipAddress,
        appId: data.appId,
        createdAt: new Date().toISOString(),
        verified: false,
        ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
      },
    });

    await docClient.send(command);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const command = new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
    });

    const result = await docClient.send(command);
    return result.Item as SessionData | null;
  }

  async markSessionAsVerified(
    sessionId: string,
    authToken: string
  ): Promise<void> {
    const command = new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression:
        "SET verified = :verified, authToken = :authToken, verifiedAt = :verifiedAt",
      ExpressionAttributeValues: {
        ":verified": true,
        ":authToken": authToken,
        ":verifiedAt": new Date().toISOString(),
      },
    });

    await docClient.send(command);
  }
}
