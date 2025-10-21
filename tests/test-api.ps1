#Test Case 1.1: Complete Authentication Flow
# Step 1: Validate QR (Create Session)
$validateResponse = Invoke-RestMethod -Uri "https://aiqfmqo8s1.execute-api.us-west-2.amazonaws.com/prod/validate-qr" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"appId":"test-app","secret":"test-secret","phoneNumber":"+14014408511"}'

$sessionId = $validateResponse.data.sessionId
Write-Host "[OK] Session Created: $sessionId"

# Step 2: Request OTP
$requestBody = @{
    sessionId = $sessionId
    phoneNumber = "+14014408511"
} | ConvertTo-Json

$otpResponse = Invoke-RestMethod -Uri "https://aiqfmqo8s1.execute-api.us-west-2.amazonaws.com/prod/request-otp" `
  -Method Post `
  -ContentType "application/json" `
  -Body $requestBody

Write-Host "[OK] OTP Requested - Check your phone!"

# Wait for SMS and get OTP
$otp = Read-Host "Enter the OTP you received"

# Step 3: Verify OTP
$verifyBody = @{
    sessionId = $sessionId
    otp = $otp
} | ConvertTo-Json

$verifyResponse = Invoke-RestMethod -Uri "https://aiqfmqo8s1.execute-api.us-west-2.amazonaws.com/prod/verify-otp" `
  -Method Post `
  -ContentType "application/json" `
  -Body $verifyBody

Write-Host "[OK] OTP Verified!"
Write-Host ('Auth Token: ' + $verifyResponse.data.authToken)