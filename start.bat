@echo off
title WeatherDash - Stazione Meteo
echo ==========================================
echo    Avvio WeatherDash in corso...
echo ==========================================
echo.
if not exist node_modules (
    echo Installazione dipendenze in corso...
    call npm install
)
echo Apertura browser su http://localhost:3000...
start http://localhost:3000
node server.js
pause
