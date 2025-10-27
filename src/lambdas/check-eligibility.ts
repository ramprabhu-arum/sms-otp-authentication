import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import * as crypto from "crypto";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-west-2",
});
const SMS_QUEUE_URL = process.env.SMS_QUEUE_URL;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

/**
 * POST /check-eligibility
 *
 * Checks discount eligibility based on phone number and sends SMS via Twilio.
 *
 * Business Logic:
 * - If phone number's last digit is odd: 10% discount
 * - If phone number's last digit is even: 8% discount
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Check eligibility request:", JSON.stringify(event, null, 2));

    // Handle preflight OPTIONS request
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { phoneNumber, authToken } = body;

    console.log("Request body:", { phoneNumber, hasAuthToken: !!authToken });

    // Validate required fields
    if (!phoneNumber || !authToken) {
      console.error("Missing required fields");
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: phoneNumber, authToken",
        }),
      };
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      console.error("Invalid phone number format:", phoneNumber);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Invalid phone number format",
        }),
      };
    }

    // Extract last digit and determine discount
    const lastDigit = parseInt(phoneNumber.slice(-1));
    const isOdd = lastDigit % 2 !== 0;
    const discountPercentage = isOdd ? 10 : 8;

    console.log("Eligibility calculation:", {
      phoneNumber,
      lastDigit,
      isOdd,
      discountPercentage,
    });

    // Generate unique discount code
    const codePrefix = `SAVE${discountPercentage}`;
    const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const discountCode = `${codePrefix}-${randomSuffix}`;

    console.log("Discount code generated:", discountCode);

    // Prepare SMS message
    const smsMessage = `🎉 Congratulations! You're eligible for a ${discountPercentage}% discount! Use code: ${discountCode} at checkout. Valid for 24 hours.`;

    console.log("Sending SMS via SQS...");

    // Send SMS via SQS
    if (!SMS_QUEUE_URL) {
      console.error("SMS_QUEUE_URL not configured");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "SMS service not configured",
        }),
      };
    }

    const sqsMessage = {
      phoneNumber,
      message: smsMessage,
      messageType: "discount-offer",
    };

    const command = new SendMessageCommand({
      QueueUrl: SMS_QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage),
      MessageAttributes: {
        phoneNumber: {
          DataType: "String",
          StringValue: phoneNumber,
        },
        messageType: {
          DataType: "String",
          StringValue: "discount-offer",
        },
      },
    });

    await sqsClient.send(command);

    console.log("SMS queued successfully");

    const response = {
      success: true,
      data: {
        eligible: true,
        discountPercentage,
        discountCode,
        message: `Congratulations! You're eligible for a ${discountPercentage}% discount.`,
        smsStatus: "queued",
        expiresIn: 86400, // 24 hours in seconds
      },
    };

    console.log("Response:", response);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error("Error in check-eligibility handler:", error);
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
