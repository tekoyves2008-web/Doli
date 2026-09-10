@echo off
REM Lance le backend Doli (port 3001) dans sa propre fenetre.
cd /d "%~dp0"
start "BACKEND-DOLI" cmd /k "node server\index.js"
echo Fenetre BACKEND-DOLI ouverte. Verifiez qu'elle affiche : API Doli sur http://0.0.0.0:3001
