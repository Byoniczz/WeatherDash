@echo off
title WeatherDash - Docker Launch
echo ==========================================
echo    Avvio WeatherDash con Docker Compose
echo ==========================================
echo.
docker compose up -d
if %errorlevel% neq 0 (
    echo.
    echo [ERRORE] Assicurati che Docker sia installato e avviato!
    pause
    exit /b %errorlevel%
)
echo.
echo WeatherDash e attivo!
echo Apertura browser su http://localhost:3000...
start http://localhost:3000
pause
