@echo off
REM =====================================================
REM  Doli - Lance le backend ET le frontend ensemble
REM  Backend : http://localhost:3001
REM  Frontend: http://localhost:5173
REM =====================================================
cd /d "c:\Users\user\Gestionnaire de tâche"

REM --- Démarre le backend en arrière-plan ------------------
start "Doli-Backend" cmd /k "npm run server"

REM --- Attend que le backend soit prêt (port 3001) ---------
echo Demarrage du backend, attente du port 3001...
:attente
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3001" >nul 2>&1
if errorlevel 1 goto attente

echo Backend prete sur http://localhost:3001
echo.

REM --- Lance le frontend (Vite) au premier plan ------------
echo Depliage du frontend sur http://localhost:5173 ...
npm run dev