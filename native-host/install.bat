@echo off
echo Installing IDM Native Messaging Host...
echo.

:: Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "MANIFEST_PATH=%SCRIPT_DIR%com.browser_extension.idm.json"

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Update manifest with correct path
echo Updating manifest with correct path...
set "BAT_PATH=%SCRIPT_DIR%idm-host.bat"
:: Replace forward slashes and escape backslashes for JSON
set "BAT_PATH=%BAT_PATH:\=\\%"

:: Create updated manifest
echo {> "%MANIFEST_PATH%"
echo   "name": "com.browser_extension.idm",>> "%MANIFEST_PATH%"
echo   "description": "Native messaging host for IDM integration",>> "%MANIFEST_PATH%"
echo   "path": "%BAT_PATH%",>> "%MANIFEST_PATH%"
echo   "type": "stdio",>> "%MANIFEST_PATH%"
echo   "allowed_origins": ["chrome-extension://*/*"]>> "%MANIFEST_PATH%"
echo }>> "%MANIFEST_PATH%"

:: Register with Chrome (current user)
echo Registering with Chrome...
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.browser_extension.idm" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

if %ERRORLEVEL% equ 0 (
    echo.
    echo SUCCESS! Native messaging host installed.
    echo.
    echo IMPORTANT: You need to update the extension ID in the manifest:
    echo 1. Load the extension in Chrome (chrome://extensions)
    echo 2. Copy the extension ID
    echo 3. Edit: %MANIFEST_PATH%
    echo 4. Replace "chrome-extension://*/*" with "chrome-extension://YOUR_ID/"
    echo 5. Run this install script again
    echo.
) else (
    echo.
    echo ERROR: Failed to register native messaging host.
)

pause
