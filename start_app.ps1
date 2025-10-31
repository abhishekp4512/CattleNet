# Cattle Dashboard Startup Script
Write-Host "Starting Cattle Health Monitoring Dashboard..." -ForegroundColor Green

# Define paths
$backendDir = ".\backend"

# Check if we have Python installed
try {
    $pythonVersion = python --version
    Write-Host "Using $pythonVersion" -ForegroundColor Cyan
}
catch {
    Write-Host "Error: Python not found. Please install Python 3.7 or higher." -ForegroundColor Red
    exit 1
}

# Check if we have Node.js installed
try {
    $nodeVersion = node --version
    Write-Host "Using Node.js $nodeVersion" -ForegroundColor Cyan
}
catch {
    Write-Host "Error: Node.js not found. Please install Node.js." -ForegroundColor Red
    exit 1
}

# Install backend dependencies
Write-Host "`n[1/4] Installing backend dependencies..." -ForegroundColor Yellow
Push-Location $backendDir
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing backend dependencies. Please check requirements.txt." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Install frontend dependencies
Write-Host "`n[2/4] Installing frontend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing frontend dependencies. Please check package.json." -ForegroundColor Red
    exit 1
}

# Start backend in a new window
Write-Host "`n[3/4] Starting Flask backend..." -ForegroundColor Yellow
$backendCommand = "cd $backendDir; python app.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand

# Give the backend a moment to start
Write-Host "Waiting for backend to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Start frontend
Write-Host "`n[4/4] Starting React frontend..." -ForegroundColor Yellow
Write-Host "The application will open in your default browser shortly." -ForegroundColor Green
npm start