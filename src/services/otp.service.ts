import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import * as crypto from "crypto";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-west-2",
});
const docClient = DynamoDBDocumentClient.from(client);

const RECORDS_TABLE = process.env.RECORDS_TABLE || "sms-otp-records";
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes

export class OTPService {
  generateOTP(): string {
    // Generate a cryptographically secure 6-digit OTP
    const buffer = crypto.randomBytes(4);
    const num = buffer.readUInt32BE(0);
    const otp = (num % 1000000).toString().padStart(OTP_LENGTH, "0");
    return otp;
  }

  hashOTP(otp: string, phoneNumber: string): string {
    // Hash OTP with phone number as salt for security
    return crypto
      .createHmac(
        "sha256",
        process.env.OTP_SECRET || "default-secret-change-in-production"
      )
      .update(otp + phoneNumber)
      .digest("hex");
  }

  async storeOTP(
    sessionId: string,
    phoneNumber: string,
    otp: string
  ): Promise<void> {
    const hashedOTP = this.hashOTP(otp, phoneNumber);
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRY_SECONDS * 1000
    ).toISOString();

    const command = new PutCommand({
      TableName: RECORDS_TABLE,
      Item: {
        sessionId, // Primary key
        phoneNumber,
        otpHash: hashedOTP,
        createdAt: new Date().toISOString(),
        expiresAt,
        attempts: 0,
        ttl: Math.floor(Date.now() / 1000) + OTP_EXPIRY_SECONDS,
      },
    });

    await docClient.send(command);
  }

  async verifyOTP(sessionId: string, otp: string): Promise<boolean> {
    // Get OTP record directly by sessionId (primary key)
    const command = new GetCommand({
      TableName: RECORDS_TABLE,
      Key: { sessionId },
    });

    const result = await docClient.send(command);
    const record = result.Item;

    if (!record) {
      return false;
    }

    // Check if OTP has expired
    if (new Date(record.expiresAt) < new Date()) {
      await this.deleteOTP(sessionId);
      return false;
    }

    // Check if too many attempts
    if (record.attempts >= 3) {
      await this.deleteOTP(sessionId);
      return false;
    }

    // Verify OTP using timing-safe comparison
    const hashedInput = this.hashOTP(otp, record.phoneNumber);

    // Make sure both buffers are the same length
    if (hashedInput.length !== record.otpHash.length) {
      await this.incrementAttempts(sessionId, record.attempts);
      return false;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(hashedInput),
      Buffer.from(record.otpHash)
    );

    if (isValid) {
      // Delete OTP after successful verification
      await this.deleteOTP(sessionId);
      return true;
    } else {
      // Increment attempt counter
      await this.incrementAttempts(sessionId, record.attempts);
      return false;
    }
  }

  private async incrementAttempts(
    sessionId: string,
    currentAttempts: number
  ): Promise<void> {
    const command = new UpdateCommand({
      TableName: RECORDS_TABLE,
      Key: { sessionId }, // Use sessionId as key
      UpdateExpression: "SET attempts = :attempts",
      ExpressionAttributeValues: {
        ":attempts": currentAttempts + 1,
      },
    });

    await docClient.send(command);
  }

  private async deleteOTP(sessionId: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: RECORDS_TABLE,
      Key: { sessionId }, // Use sessionId as key
    });

    await docClient.send(command);
  }
}
