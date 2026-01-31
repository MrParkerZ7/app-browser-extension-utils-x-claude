@echo off
echo Uninstalling IDM Native Messaging Host...
echo.

:: Remove registry entry
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.browser_extension.idm" /f 2>nul

if %ERRORLEVEL% equ 0 (
    echo SUCCESS! Native messaging host uninstalled.
) else (
    echo Native messaging host was not installed or already removed.
)

pause
