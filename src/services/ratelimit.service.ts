import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
});
const docClient = DynamoDBDocumentClient.from(client);

const RATE_LIMITS_TABLE =
  process.env.RATE_LIMITS_TABLE || "sms-otp-rate-limits";

const LIMITS = {
  phone: { max: 5, windowSeconds: 3600 }, // 5 per hour
  ip: { max: 20, windowSeconds: 3600 }, // 20 per hour
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export class RateLimitService {
  async checkRateLimit(
    identifier: string,
    type: "phone" | "ip"
  ): Promise<RateLimitResult> {
    const limit = LIMITS[type];
    const key = `${type}:${identifier}`;

    const command = new GetCommand({
      TableName: RATE_LIMITS_TABLE,
      Key: { identifier: key },
    });

    const result = await docClient.send(command);
    const record = result.Item;

    if (!record) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowStart = new Date(record.windowStart).getTime();
    const windowEnd = windowStart + limit.windowSeconds * 1000;

    // Check if we're still in the same window
    if (now < windowEnd) {
      if (record.count >= limit.max) {
        const retryAfter = Math.ceil((windowEnd - now) / 1000);
        return { allowed: false, retryAfter };
      }
      return { allowed: true };
    }

    // Window has expired, allow the request
    return { allowed: true };
  }

  async incrementRateLimit(
    identifier: string,
    type: "phone" | "ip"
  ): Promise<void> {
    const limit = LIMITS[type];
    const key = `${type}:${identifier}`;
    const now = new Date().toISOString();

    const getCommand = new GetCommand({
      TableName: RATE_LIMITS_TABLE,
      Key: { identifier: key },
    });

    const result = await docClient.send(getCommand);
    const record = result.Item;

    if (!record) {
      // Create new record
      const putCommand = new PutCommand({
        TableName: RATE_LIMITS_TABLE,
        Item: {
          identifier: key,
          count: 1,
          windowStart: now,
          ttl: Math.floor(Date.now() / 1000) + limit.windowSeconds,
        },
      });
      await docClient.send(putCommand);
    } else {
      const windowStart = new Date(record.windowStart).getTime();
      const windowEnd = windowStart + limit.windowSeconds * 1000;

      if (Date.now() < windowEnd) {
        // Increment count in current window
        const updateCommand = new UpdateCommand({
          TableName: RATE_LIMITS_TABLE,
          Key: { identifier: key },
          UpdateExpression: "SET #count = #count + :inc",
          ExpressionAttributeNames: {
            "#count": "count",
          },
          ExpressionAttributeValues: {
            ":inc": 1,
          },
        });
        await docClient.send(updateCommand);
      } else {
        // Start new window
        const putCommand = new PutCommand({
          TableName: RATE_LIMITS_TABLE,
          Item: {
            identifier: key,
            count: 1,
            windowStart: now,
            ttl: Math.floor(Date.now() / 1000) + limit.windowSeconds,
          },
        });
        await docClient.send(putCommand);
      }
    }
  }
}
