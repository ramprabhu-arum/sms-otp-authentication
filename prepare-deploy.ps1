# prepare-deploy.ps1
Write-Host "Preparing Lambda deployment package..." -ForegroundColor Cyan

# Clean dist folder
if (Test-Path dist) {
    Remove-Item -Recurse -Force dist
}

# Rebuild
Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build

# Copy package.json to dist
Copy-Item package.json dist\

# Install production dependencies in dist
Write-Host "Installing production dependencies..." -ForegroundColor Yellow
Push-Location dist
npm install --production
Pop-Location

# Remove package files (not needed in Lambda)
Remove-Item dist\package.json
Remove-Item dist\package-lock.json

Write-Host "Deployment package ready!" -ForegroundColor Green