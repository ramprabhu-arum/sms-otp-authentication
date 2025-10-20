// src/utils/lambda-response.ts

/**
 * Standard API Gateway response builder
 */
export function buildResponse(
  statusCode: number,
  body: any,
  headers?: Record<string, string>
) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // CORS
      "Access-Control-Allow-Credentials": true,
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Success response (200)
 */
export function successResponse(data: any, message?: string) {
  return buildResponse(200, {
    success: true,
    message: message || "Success",
    data,
  });
}

/**
 * Error response with appropriate status code
 */
export function errorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
  details?: any
) {
  return buildResponse(statusCode, {
    success: false,
    errorCode,
    message,
    details,
  });
}

/**
 * Bad request (400)
 */
export function badRequestResponse(message: string, details?: any) {
  return errorResponse(400, "BAD_REQUEST", message, details);
}

/**
 * Unauthorized (401)
 */
export function unauthorizedResponse(message: string) {
  return errorResponse(401, "UNAUTHORIZED", message);
}

/**
 * Forbidden (403)
 */
export function forbiddenResponse(message: string) {
  return errorResponse(403, "FORBIDDEN", message);
}

/**
 * Not found (404)
 */
export function notFoundResponse(message: string) {
  return errorResponse(404, "NOT_FOUND", message);
}

/**
 * Too many requests (429)
 */
export function rateLimitResponse(resetAt: number) {
  return buildResponse(
    429,
    {
      success: false,
      errorCode: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
      resetAt,
    },
    {
      "Retry-After": Math.ceil((resetAt - Date.now()) / 1000).toString(),
    }
  );
}

/**
 * Internal server error (500)
 */
export function serverErrorResponse(message?: string) {
  return errorResponse(
    500,
    "INTERNAL_SERVER_ERROR",
    message || "An unexpected error occurred"
  );
}
