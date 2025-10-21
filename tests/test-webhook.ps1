# test-webhook.ps1
$API_URL = "https://58fd4379y6.execute-api.us-west-2.amazonaws.com/prod/"  # Replace with your actual API URL

Write-Host "Testing Twilio Webhook..." -ForegroundColor Cyan

# Simulate Twilio webhook call
$body = "MessageSid=SM123456&MessageStatus=delivered&To=%2B14014408511&From=%2B15855801246&ErrorCode=&ErrorMessage="

$response = Invoke-RestMethod `
    -Uri "${API_URL}twilio-webhook" `
    -Method POST `
    -Body $body `
    -ContentType "application/x-www-form-urlencoded"

Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Green