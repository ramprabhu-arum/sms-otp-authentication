# verify-setup.ps1
Write-Host "🔍 Verifying Environment Setup..." -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "✓ Checking Node.js..." -ForegroundColor Green
node --version

# Check npm
Write-Host "✓ Checking npm..." -ForegroundColor Green
npm --version

# Check Git
Write-Host "✓ Checking Git..." -ForegroundColor Green
git --version

# Check AWS CLI
Write-Host "✓ Checking AWS CLI..." -ForegroundColor Green
aws --version

# Check AWS credentials
Write-Host "✓ Checking AWS credentials..." -ForegroundColor Green
aws sts get-caller-identity

# Check SAM CLI
Write-Host "✓ Checking SAM CLI..." -ForegroundColor Green
sam --version

# Check Serverless Framework
Write-Host "✓ Checking Serverless Framework..." -ForegroundColor Green
serverless --version

Write-Host ""
Write-Host "✅ Environment setup verification complete!" -ForegroundColor Green