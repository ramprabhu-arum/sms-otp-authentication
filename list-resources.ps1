# list-resources.ps1
Write-Host "SMS OTP Infrastructure Resources" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "DynamoDB Tables:" -ForegroundColor Green
aws dynamodb list-tables --query 'TableNames[?starts_with(@, `sms-otp`)]' --output table

Write-Host ""
Write-Host "SQS Queues:" -ForegroundColor Green
aws sqs list-queues --query 'QueueUrls[?contains(@, `sms-otp`)]' --output table

Write-Host ""
Write-Host "IAM Roles:" -ForegroundColor Green
aws iam list-roles --query 'Roles[?RoleName==`sms-otp-lambda-execution-role`].[RoleName,Arn]' --output table

Write-Host ""
Write-Host "API Gateway:" -ForegroundColor Green
aws apigateway get-rest-apis --query "items[?name=='SMS-OTP-API'].[name,id]" --output table

Write-Host ""
Write-Host "CloudWatch Log Groups:" -ForegroundColor Green
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/sms-otp --query 'logGroups[].logGroupName' --output table

Write-Host ""
Write-Host "Infrastructure listing complete!" -ForegroundColor Green
