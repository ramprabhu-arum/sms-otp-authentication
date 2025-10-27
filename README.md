# SMS OTP Authentication System 📱

<div align="center">

![SMS OTP System](https://img.shields.io/badge/SMS-OTP-blue)
![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange)
![DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-blue)
![Twilio](https://img.shields.io/badge/SMS-Twilio-red)

</div>

## 📑 Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [System Architecture](#system-architecture)
- [API Reference](#api-reference)
- [Development Guide](#development-guide)
- [Monitoring & Debugging](#monitoring--debugging)
- [Troubleshooting](#troubleshooting)

## Overview

The SMS OTP Authentication System provides secure phone number verification using time-based one-time passwords delivered via SMS. Built on AWS serverless architecture using Lambda, DynamoDB, and Twilio for SMS delivery.

### Key Features

- 🔐 Secure OTP Generation
- 📲 SMS Delivery via Twilio
- ⏱️ Time-based OTP Expiry
- 🚫 Rate Limiting
- 📝 Audit Logging
- 🔄 Automatic Retry for Failed SMS

## Getting Started

### Prerequisites

```bash
# Required tools
node v18+
npm v8+
aws-cli v2+
sam-cli (latest)
```

### Quick Start

1. **Clone & Setup**

   ```bash
   git clone https://github.com/ramprabhu-arum/sms-otp-authentication.git
   cd sms-otp
   npm install
   ```

2. **Configure AWS**

   ```bash
   aws configure  # Set your AWS credentials
   ```

3. **Deploy Infrastructure**

   ```bash
   # First deployment
   sam deploy -t template.yaml --guided

   # Subsequent deployments
   sam deploy --template-file template-simple.yaml \
             --stack-name sms-otp-lambdas \
             --capabilities CAPABILITY_IAM \
             --force-upload
   ```

## System Architecture

### Flow Diagram

\`\`\`mermaid
sequenceDiagram
Client->>API Gateway: 1. POST /validate-qr
API Gateway->>Lambda: validate-qr
Lambda->>DynamoDB: Create session
Lambda->>Client: Return sessionId
Client->>API Gateway: 2. POST /request-otp
API Gateway->>Lambda: request-otp
Lambda->>SQS: Queue SMS
Lambda->>Client: Success response
SQS->>Lambda: Trigger sms-sender
Lambda->>Twilio: Send SMS
Client->>API Gateway: 3. POST /verify-otp
Lambda->>DynamoDB: Verify OTP
Lambda->>Client: Return authToken
\`\`\`

### Components

- **API Gateway**: REST API endpoints
- **Lambda Functions**: Serverless compute
- **DynamoDB**: Session & OTP storage
- **SQS**: Message queuing for SMS
- **Twilio**: SMS delivery service

## API Reference

### Endpoints

#### 1. Validate QR Code

\`\`\`http
POST /validate-qr
Content-Type: application/json

{
"appId": "test-app",
"secret": "test-secret",
"phoneNumber": "+1234567890"
}
\`\`\`

#### 2. Request OTP

\`\`\`http
POST /request-otp
Content-Type: application/json

{
"sessionId": "uuid",
"phoneNumber": "+1234567890"
}
\`\`\`

#### 3. Verify OTP

\`\`\`http
POST /verify-otp
Content-Type: application/json

{
"sessionId": "uuid",
"otp": "123456"
}
\`\`\`

## Development Guide

### Project Structure

\`\`\`
sms-otp/
├── src/
│ ├── lambdas/ # Lambda function handlers
│ ├── services/ # Business logic
│ └── utils/ # Shared utilities
├── tests/ # Test scripts
├── lambda-layer/ # Shared dependencies
├── template.yaml # SAM template
└── package.json # Project config
\`\`\`

### Testing

1. **Run Full Test Flow**

   ```powershell
   ./tests/test-step1-validate-qr.ps1
   ./tests/test-step2-request-otp.ps1
   ./tests/test-step3-verify-otp.ps1
   ```

2. **Test Single API**
   ```powershell
   ./tests/test-api.ps1
   ```

### Database Schema

#### Sessions Table

- Table: \`sms-otp-sessions\`
- Key: \`sessionId\` (String)
- TTL: 1 hour

#### OTP Records Table

- Table: \`sms-otp-records\`
- Key: \`otpId\` (String)
- TTL: 5 minutes

#### Rate Limits Table

- Table: \`sms-otp-rate-limits\`
- Key: \`identifier\` (String)
- TTL: 1 hour

## Monitoring & Debugging

### CloudWatch Logs

```powershell
# Watch Lambda logs in real-time
aws logs tail /aws/lambda/request-otp --follow
aws logs tail /aws/lambda/sms-sender --follow
aws logs tail /aws/lambda/verify-otp --follow

# Get recent logs
aws logs tail /aws/lambda/request-otp --since 2m --format short
```

### DynamoDB Queries

```powershell
# Check session status
aws dynamodb get-item \
  --table-name sms-otp-sessions \
  --key '{"sessionId":{"S":"your-session-id"}}'

# Scan rate limits
aws dynamodb scan --table-name sms-otp-rate-limits
```

## Troubleshooting

### Common Issues

1. **OTP Not Received**
   - Check sms-sender logs
   - Verify phone format (E.164)
   - Check Twilio credentials

2. **Rate Limit Exceeded**
   - Phone: 5 requests/hour
   - IP: 20 requests/hour
   - Check rate-limits table

3. **Session Invalid**
   - Verify session exists
   - Check session expiration
   - Ensure correct sessionId

### Quick Fixes

1. **Reset Rate Limits**

   ```powershell
   aws dynamodb delete-item \
     --table-name sms-otp-rate-limits \
     --key '{"identifier":{"S":"phone_+1234567890"}}'
   ```

2. **Clear Sessions**
   ```powershell
   aws dynamodb scan \
     --table-name sms-otp-sessions \
     --projection-expression "sessionId" \
     --query "Items[*].sessionId.S" \
     --output text | ForEach-Object {
       aws dynamodb delete-item \
         --table-name sms-otp-sessions \
         --key "{\"sessionId\":{\"S\":\"$_\"}}"
     }
   ```

## Environment Variables

```bash
# Core Settings
AWS_REGION=us-west-2
DEBUG_LOGGING=true

# DynamoDB Tables
SESSIONS_TABLE=sms-otp-sessions
RECORDS_TABLE=sms-otp-records
RATE_LIMITS_TABLE=sms-otp-rate-limits
AUDIT_LOGS_TABLE=sms-otp-audit-logs

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Queue URLs
SMS_QUEUE_URL=https://sqs.region.amazonaws.com/account/sms-queue
EVENTS_QUEUE_URL=https://sqs.region.amazonaws.com/account/events-queue
```

## Quick Links

- [AWS Lambda Console](https://console.aws.amazon.com/lambda)
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logs:)
- [DynamoDB Tables](https://console.aws.amazon.com/dynamodb/home)
- [API Gateway](https://console.aws.amazon.com/apigateway)
- [Twilio Console](https://console.twilio.com/)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
