@echo off
chcp 65001 >nul
title Kizen Web Server
cd /d "%~dp0"

echo ===================================================
echo  Starting Kizen Multi-Threaded Web App Server...
echo ===================================================

py -3.12 server\start_server.py
if %ERRORLEVEL% NEQ 0 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" server\start_server.py
    ) else (
        python server\start_server.py
    )
)

pause
