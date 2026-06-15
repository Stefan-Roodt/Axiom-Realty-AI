@echo off
cd /d "%~dp0"

echo Starting Axiom Realty AI...
echo.
echo This window runs the website. Leave it open.
echo.
echo Website: http://localhost:8080/
echo Admin:   http://localhost:8080/?admin=1#admin
echo.

C:\Progra~1\nodejs\node.exe server.js

echo.
echo Axiom Realty AI stopped.
pause
