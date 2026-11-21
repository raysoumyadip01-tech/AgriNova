@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo   AgriNova - Windows 11 Quick Launcher
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo Created .env from .env.example
  )
)

if not exist "node_modules" (
  echo Installing packages for first run...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting AgriNova at http://localhost:3000 ...
echo Chrome will open automatically once the server is ready.
start "" /min cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"
call npm run dev
pause
