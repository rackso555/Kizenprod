@echo off
title Kizen CouchDB Sync Service
cd /d "%~dp0"

echo ===================================================
echo  Starting Kizen CouchDB PC Sync Service...
echo ===================================================

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" server\couchdb_sync_service.py
) else (
    py -3.12 server\couchdb_sync_service.py
)

pause
