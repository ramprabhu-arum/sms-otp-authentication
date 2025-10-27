# Test Step 3: verify-otp

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "STEP 3: Testing verify-otp" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""



$sessionId = "c2f299f5-115a-463f-96fd-327714b36760".Trim()
$otp = "545194".Trim()

Write-Host "Using Session ID: $sessionId" -ForegroundColor Gray
Write-Host "Using OTP: $otp" -ForegroundColor Gray
Write-Host ""

# Call API
Write-Host "[1/2] Calling verify-otp API..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "https://aiqfmqo8s1.execute-api.us-west-2.amazonaws.com/prod/verify-otp" `
        -Method Post `
        -ContentType "application/json" `
        -Body "{`"sessionId`":`"$sessionId`",`"otp`":`"$otp`"}"

    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""

    if ($response.success) {
        Write-Host "SUCCESS!" -ForegroundColor Green
        Write-Host "Auth Token: $($response.data.authToken)" -ForegroundColor Cyan
        Write-Host ""
        
        # Save token
        $response.data.authToken | Out-File -FilePath "auth-token.txt" -Encoding utf8 -NoNewline
        Write-Host "Auth token saved to auth-token.txt" -ForegroundColor Gray
    } else {
        Write-Host "VERIFICATION FAILED!" -ForegroundColor Red
        Write-Host "Error: $($response.error)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible reasons:" -ForegroundColor Yellow
        Write-Host "  - OTP expired (5 minute limit)" -ForegroundColor White
        Write-Host "  - OTP already used" -ForegroundColor White
        Write-Host "  - Wrong OTP entered" -ForegroundColor White
        Write-Host "  - OTP mismatch (old SMS received)" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "API call failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    $_ | Format-List * | Out-String | Write-Host
    exit 1
}

# Check logs
Write-Host ""
Write-Host "[2/2] Checking verify-otp logs..." -ForegroundColor Yellow
Write-Host ""

aws logs tail /aws/lambda/verify-otp --since 2m --format short

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "STEP 3 COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ALL TESTS PASSED!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your SMS OTP authentication system is working correctly!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  1. Session created: $sessionId" -ForegroundColor White
Write-Host "  2. OTP sent via SMS: $otp" -ForegroundColor White
Write-Host "  3. OTP verified successfully" -ForegroundColor White
Write-Host "  4. Auth token issued" -ForegroundColor White
Write-Host ""

