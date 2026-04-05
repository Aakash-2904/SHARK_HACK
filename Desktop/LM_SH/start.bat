@echo off
echo Starting Luminary...

start cmd /k "cd C:\Users\Windows 11\Desktop\Luminary-main (5)\Luminary-main\backend && python -m uvicorn main:app --reload --port 8000"

timeout /t 3

start cmd /k "cd C:\Users\Windows 11\Desktop\Luminary-main (5)\Luminary-main\frontend && npm run dev"

echo Both servers starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
pause