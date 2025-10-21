import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-west-2",
});
const SMS_QUEUE_URL = process.env.SMS_QUEUE_URL;

export interface SMSMessage {
  phoneNumber: string;
  otp: string;
  sessionId: string;
}

export class SQSService {
  async sendSMSMessage(data: SMSMessage): Promise<void> {
    if (!SMS_QUEUE_URL) {
      throw new Error("SMS_QUEUE_URL environment variable is not set");
    }

    const command = new SendMessageCommand({
      QueueUrl: SMS_QUEUE_URL,
      MessageBody: JSON.stringify(data),
      MessageAttributes: {
        phoneNumber: {
          DataType: "String",
          StringValue: data.phoneNumber,
        },
        sessionId: {
          DataType: "String",
          StringValue: data.sessionId,
        },
      },
    });

    await sqsClient.send(command);
  }
}
