@echo off
ECHO Starting Cattle Dashboard...

ECHO Starting Flask backend...
start cmd /k "cd backend && python -m pip install -r requirements.txt && python app.py"

ECHO Starting React frontend...
start cmd /k "npm start"

ECHO Services started successfully!
ECHO Backend: http://localhost:5000
ECHO Frontend: http://localhost:3000