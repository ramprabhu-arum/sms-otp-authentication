# Super Fast Lambda Deploy
# Deploys Lambda functions directly without CloudFormation
# Usage: .\super-fast-deploy.ps1 -Functions @("request-otp", "sms-sender")

param(
    [Parameter(Mandatory=$false)]
    [string[]]$Functions = @("request-otp", "sms-sender")
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Super Fast Lambda Deploy" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build TypeScript
Write-Host "[1/4] Building TypeScript..." -ForegroundColor Yellow
try {
    npm run build | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "  Build successful" -ForegroundColor Green
} catch {
    Write-Host "  Build failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Create deployment package
Write-Host ""
Write-Host "[2/4] Creating deployment package..." -ForegroundColor Yellow
$zipFile = "lambda-deploy.zip"

try {
    # Remove old zip if exists
    if (Test-Path $zipFile) {
        Remove-Item $zipFile -Force
    }

    # Create zip with dist and node_modules
    Compress-Archive -Path "dist/*","node_modules" -DestinationPath $zipFile -Force
    
    $zipSize = (Get-Item $zipFile).Length / 1MB
    Write-Host "  Package created: $zipFile ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
} catch {
    Write-Host "  Package creation failed: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Deploy to Lambda functions
Write-Host ""
Write-Host "[3/4] Deploying to Lambda functions..." -ForegroundColor Yellow

$deployed = 0
$failed = 0

foreach ($functionName in $Functions) {
    Write-Host "  Deploying $functionName..." -NoNewline
    
    try {
        aws lambda update-function-code `
            --function-name $functionName `
            --zip-file fileb://$zipFile `
            --region us-west-2 `
            --no-cli-pager `
            --output json | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
            $deployed++
        } else {
            Write-Host " FAILED" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
        $failed++
    }
}

# Step 4: Cleanup
Write-Host ""
Write-Host "[4/4] Cleaning up..." -ForegroundColor Yellow
try {
    Remove-Item $zipFile -Force
    Write-Host "  Cleanup complete" -ForegroundColor Green
} catch {
    Write-Host "  Cleanup warning: $_" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Deployment Summary" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Deployed: $deployed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Test: .\tests\test-api.ps1" -ForegroundColor Gray
    Write-Host "  2. Watch logs: aws logs tail /aws/lambda/$($Functions[0]) --follow" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "Deployment completed with errors" -ForegroundColor Red
    exit 1
}

