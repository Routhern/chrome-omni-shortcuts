@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
    echo Chrome.exe was not found.
    echo Update this launcher with your Chrome install path.
    pause
    exit /b 1
)

set "EXTENSIONS="
for /d %%D in ("%~dp0extensions\shortcut-*") do (
    if exist "%%~fD\manifest.json" (
        if defined EXTENSIONS (
            set "EXTENSIONS=!EXTENSIONS!,%%~fD"
        ) else (
            set "EXTENSIONS=%%~fD"
        )
    )
)

if not defined EXTENSIONS (
    echo No shortcut extension directories were found.
    pause
    exit /b 1
)

echo Close all Chrome windows before using this launcher.
echo Loading:
echo %EXTENSIONS%
start "" "%CHROME%" --profile-directory="Default" "--load-extension=%EXTENSIONS%"
