# Test Step 1: validate-qr

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "STEP 1: Testing validate-qr" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Call API
Write-Host "[1/2] Calling validate-qr API..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "https://aiqfmqo8s1.execute-api.us-west-2.amazonaws.com/prod/validate-qr" `
        -Method Post `
        -ContentType "application/json" `
        -Body '{"appId":"test-app","secret":"test-secret","phoneNumber":"+14014408512"}'

    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""

    if ($response.success) {
        $sessionId = $response.data.sessionId
        Write-Host "Session ID: $sessionId" -ForegroundColor Green
        
        # Save for next steps
        $sessionId | Out-File -FilePath "session-id.txt" -Encoding utf8 -NoNewline
        Write-Host "Session ID saved to session-id.txt" -ForegroundColor Gray
    } else {
        Write-Host "ERROR: $($response.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "API call failed: $_" -ForegroundColor Red
    exit 1
}

# Check logs
Write-Host ""
Write-Host "[2/2] Checking logs (last 2 minutes)..." -ForegroundColor Yellow
Write-Host ""

aws logs tail /aws/lambda/validate-qr --since 2m --format short

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "STEP 1 COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Run .\test-step2-request-otp.ps1" -ForegroundColor Cyan
Write-Host ""

