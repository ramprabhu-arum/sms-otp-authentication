# Quick Lambda Deploy - One Function
# Usage: .\quick-deploy.ps1 request-otp
#        .\quick-deploy.ps1 sms-sender

param(
    [Parameter(Mandatory=$true)]
    [string]$FunctionName
)

Write-Host "⚡ Quick deploying $FunctionName..." -ForegroundColor Cyan

# Build
Write-Host "Building..." -NoNewline
npm run build | Out-Null
Write-Host " ✓" -ForegroundColor Green

# Package
Write-Host "Packaging..." -NoNewline
Compress-Archive -Path "dist/*","node_modules" -DestinationPath temp.zip -Force
Write-Host " ✓" -ForegroundColor Green

# Deploy
Write-Host "Deploying..." -NoNewline
aws lambda update-function-code --function-name $FunctionName --zip-file fileb://temp.zip --region us-west-2 --no-cli-pager | Out-Null
Write-Host " ✓" -ForegroundColor Green

# Cleanup
Remove-Item temp.zip -Force

Write-Host "✅ Done! Test now." -ForegroundColor Green

