@echo off
title SonicBurn - Windows CD Burner
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
    echo Electron is not installed. Running npm install...
    call npm.cmd install
)
start "" "node_modules\electron\dist\electron.exe" .
