// src/utils/api-context.ts
import { APIGatewayProxyEvent } from "aws-lambda";
import { APIContext } from "../types";

/**
 * Extract context information from API Gateway event
 */
export function extractAPIContext(event: APIGatewayProxyEvent): APIContext {
  return {
    requestId: event.requestContext.requestId,
    sourceIp: event.requestContext.identity.sourceIp,
    userAgent: event.headers["User-Agent"] || event.headers["user-agent"],
  };
}

/**
 * Parse and validate JSON body
 */
export function parseBody<T>(event: APIGatewayProxyEvent): T | null {
  if (!event.body) {
    return null;
  }

  try {
    return JSON.parse(event.body) as T;
  } catch (error) {
    return null;
  }
}
