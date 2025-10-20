# cleanup-infrastructure.ps1
Write-Host "⚠️  WARNING: This will delete ALL SMS OTP infrastructure!" -ForegroundColor Red
Write-Host "This action cannot be undone." -ForegroundColor Red
$confirm = Read-Host "Are you sure? (type 'yes' to confirm)"

if ($confirm -ne "yes") {
    Write-Host "Cleanup cancelled." -ForegroundColor Yellow
    exit
}

Write-Host "`n🗑️  Deleting infrastructure..." -ForegroundColor Yellow

# Delete DynamoDB tables
Write-Host "Deleting DynamoDB tables..." -ForegroundColor Cyan
aws dynamodb delete-table --table-name sms-otp-sessions
aws dynamodb delete-table --table-name sms-otp-records
aws dynamodb delete-table --table-name sms-otp-rate-limits
aws dynamodb delete-table --table-name sms-otp-audit-logs

# Delete SQS queues
Write-Host "Deleting SQS queues..." -ForegroundColor Cyan
$OTP_EVENTS_URL = (aws sqs get-queue-url --queue-name sms-otp-events --query 'QueueUrl' --output text)
$SMS_DELIVERY_URL = (aws sqs get-queue-url --queue-name sms-otp-sms-delivery --query 'QueueUrl' --output text)
$DLQ_URL = (aws sqs get-queue-url --queue-name sms-otp-dlq --query 'QueueUrl' --output text)

aws sqs delete-queue --queue-url $OTP_EVENTS_URL
aws sqs delete-queue --queue-url $SMS_DELIVERY_URL
aws sqs delete-queue --queue-url $DLQ_URL

# Delete API Gateway
Write-Host "Deleting API Gateway..." -ForegroundColor Cyan
$API_ID = (aws apigateway get-rest-apis --query "items[?name=='SMS-OTP-API'].id" --output text)
aws apigateway delete-rest-api --rest-api-id $API_ID

# Delete CloudWatch log groups
Write-Host "Deleting CloudWatch log groups..." -ForegroundColor Cyan
aws logs delete-log-group --log-group-name /aws/lambda/sms-otp-validate-qr
aws logs delete-log-group --log-group-name /aws/lambda/sms-otp-request-otp
aws logs delete-log-group --log-group-name /aws/lambda/sms-otp-verify-otp
aws logs delete-log-group --log-group-name /aws/lambda/sms-otp-sms-sender

# Delete IAM resources
Write-Host "Deleting IAM resources..." -ForegroundColor Cyan
$AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)

aws iam detach-role-policy --role-name sms-otp-lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam detach-role-policy --role-name sms-otp-lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
aws iam detach-role-policy --role-name sms-otp-lambda-execution-role --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/sms-otp-lambda-permissions"

aws iam delete-role --role-name sms-otp-lambda-execution-role
aws iam delete-policy --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/sms-otp-lambda-permissions"

Write-Host "`n✅ Cleanup complete!" -ForegroundColor Green