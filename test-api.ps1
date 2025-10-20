# test-api.ps1
# Replace with your actual API URL
$API_URL = " https://58fd4379y6.execute-api.us-west-2.amazonaws.com/prod/"

Write-Host "Testing SMS OTP API..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Validate QR
Write-Host "Test 1: Validate QR Code" -ForegroundColor Yellow
$validateQRBody = @{
    appId = "my-app"
    secret = "dGhpc21zc3RhdGljc2VjcmV0"
    phoneNumber = "+14014408511"  # Replace with your phone number
} | ConvertTo-Json

$response1 = Invoke-RestMethod -Uri "$API_URL/validate-qr" -Method POST -Body $validateQRBody -ContentType "application/json"
Write-Host "Response:" -ForegroundColor Green
$response1 | ConvertTo-Json
$sessionId = $response1.data.sessionId
Write-Host ""

# Test 2: Request OTP
Write-Host "Test 2: Request OTP" -ForegroundColor Yellow
$requestOTPBody = @{
    sessionId = $sessionId
    phoneNumber = "+14014408511"  # Same phone number
} | ConvertTo-Json

$response2 = Invoke-RestMethod -Uri "$API_URL/request-otp" -Method POST -Body $requestOTPBody -ContentType "application/json"
Write-Host "Response:" -ForegroundColor Green
$response2 | ConvertTo-Json
Write-Host ""

# Wait for SMS
Write-Host "Check your phone for OTP SMS..." -ForegroundColor Cyan
$otp = Read-Host "Enter the OTP you received"

# Test 3: Verify OTP
Write-Host "Test 3: Verify OTP" -ForegroundColor Yellow
$verifyOTPBody = @{
    sessionId = $sessionId
    otp = $otp
} | ConvertTo-Json

$response3 = Invoke-RestMethod -Uri "$API_URL/verify-otp" -Method POST -Body $verifyOTPBody -ContentType "application/json"
Write-Host "Response:" -ForegroundColor Green
$response3 | ConvertTo-Json
Write-Host ""

Write-Host "All tests completed!" -ForegroundColor Green