@echo off
echo ========================================
echo Starting FRESH Development Server
echo ========================================
echo.

echo [1/4] Killing all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Cleaning Vite cache...
call npm run clean
timeout /t 1 /nobreak >nul

echo [3/4] Starting Vite dev server...
echo.
echo ========================================
echo IMPORTANT: Open browser in INCOGNITO mode
echo Or press Ctrl+Shift+Delete to clear cache
echo ========================================
echo.

call npm run dev
