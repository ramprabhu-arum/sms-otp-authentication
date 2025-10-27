# Test Step 2: request-otp

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "STEP 2: Testing request-otp" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""


$sessionId = "026c5d4a-982f-475a-99ec-c7c0ea264e11"
$sessionId = $sessionId.Trim()

Write-Host "Using Session ID: $sessionId" -ForegroundColor Gray
Write-Host ""

# Call API
Write-Host "[1/3] Calling request-otp API..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "https://aiqfmqo8s1.execute-api.us-west-2.amazonaws.com/prod/request-otp" `
        -Method Post `
        -ContentType "application/json" `
        -Body "{`"sessionId`":`"$sessionId`",`"phoneNumber`":`"+14014408512`"}"

    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""

    if (-not $response.success) {
        Write-Host "ERROR: $($response.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "API call failed: $_" -ForegroundColor Red
    exit 1
}

# Check request-otp logs
Write-Host "[2/3] Checking request-otp logs..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Looking for OTP value..." -ForegroundColor Gray
Write-Host ""

aws logs tail /aws/lambda/request-otp --since 2m --format short | Select-String -Pattern "otp|Step"

Write-Host ""

# Check sms-sender logs
Write-Host "[3/3] Checking sms-sender logs..." -ForegroundColor Yellow
Write-Host "Waiting 5 seconds for SQS to trigger Lambda..." -ForegroundColor Gray
Start-Sleep -Seconds 5
Write-Host ""

aws logs tail /aws/lambda/sms-sender --since 2m --format short

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "CHECK YOUR PHONE!" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

$otpFromPhone = Read-Host "Enter the OTP you received via SMS"
$otpFromPhone = $otpFromPhone.Trim()
$otpFromPhone | Out-File -FilePath "otp-from-sms.txt" -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "OTP saved: $otpFromPhone" -ForegroundColor Green
Write-Host ""

# Extract OTP from logs for comparison
Write-Host "Extracting OTP from logs for verification..." -ForegroundColor Cyan
$logOtp = aws logs tail /aws/lambda/request-otp --since 2m --format short | Select-String -Pattern '"otp":\s*"(\d{6})"' | Select-Object -First 1

if ($logOtp) {
    $logOtpValue = $logOtp -replace '.*"otp":\s*"(\d{6})".*', '$1'
    Write-Host "OTP in logs: $logOtpValue" -ForegroundColor Gray
    Write-Host "OTP from SMS: $otpFromPhone" -ForegroundColor Gray
    
    if ($logOtpValue -eq $otpFromPhone) {
        Write-Host ""
        Write-Host "OTPs MATCH!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "WARNING: OTPs DO NOT MATCH!" -ForegroundColor Red
        Write-Host "This means old messages are still being processed" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "STEP 2 COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Run .\test-step3-verify-otp.ps1" -ForegroundColor Cyan
Write-Host ""

