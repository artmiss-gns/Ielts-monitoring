@echo off
REM IELTS Appointment Monitor - Installation Script for Windows
REM This script installs the IELTS Appointment Monitor globally on your system

setlocal enabledelayedexpansion

REM Configuration
set APP_NAME=ielts-appointment-monitor
set MIN_NODE_VERSION=16.0.0

REM Colors (using Windows color codes)
set RED=[91m
set GREEN=[92m
set YELLOW=[93m
set BLUE=[94m
set NC=[0m

echo.
echo %BLUE%╔══════════════════════════════════════════════════════════════╗%NC%
echo %BLUE%║              IELTS Appointment Monitor Installer             ║%NC%
echo %BLUE%║                                                              ║%NC%
echo %BLUE%║  This script will install the IELTS Appointment Monitor     ║%NC%
echo %BLUE%║  globally on your system for easy command-line access.      ║%NC%
echo %BLUE%╚══════════════════════════════════════════════════════════════╝%NC%
echo.

REM Check if Node.js is installed
echo %BLUE%[INFO]%NC% Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Node.js is not installed or not in PATH
    echo Please install Node.js from: https://nodejs.org/
    echo Make sure to add Node.js to your PATH during installation
    pause
    exit /b 1
)

REM Get Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:v=%
echo %BLUE%[INFO]%NC% Found Node.js version: %NODE_VERSION%

REM Check npm
echo %BLUE%[INFO]%NC% Checking npm installation...
npm --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% npm is not installed or not in PATH
    echo npm should be installed with Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo %BLUE%[INFO]%NC% Found npm version: %NPM_VERSION%
echo %GREEN%[SUCCESS]%NC% Prerequisites check passed

REM Install dependencies
echo.
echo %BLUE%[INFO]%NC% Installing dependencies...
call npm install
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Failed to install dependencies
    pause
    exit /b 1
)
echo %GREEN%[SUCCESS]%NC% Dependencies installed successfully

REM Build application
echo.
echo %BLUE%[INFO]%NC% Building application...
call npm run build:prod
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Failed to build application
    pause
    exit /b 1
)
echo %GREEN%[SUCCESS]%NC% Application built successfully

REM Setup directories
echo.
echo %BLUE%[INFO]%NC% Setting up application directories...
set CONFIG_DIR=%USERPROFILE%\.ielts-monitor
set LOG_DIR=%CONFIG_DIR%\logs
set DATA_DIR=%CONFIG_DIR%\data

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

REM Copy example configuration if it doesn't exist
if not exist "%CONFIG_DIR%\config.json" (
    if exist "config\monitor-config.example.json" (
        copy "config\monitor-config.example.json" "%CONFIG_DIR%\config.json" >nul
        echo %GREEN%[SUCCESS]%NC% Created default configuration at %CONFIG_DIR%\config.json
    )
)
echo %GREEN%[SUCCESS]%NC% Application directories set up

REM Install globally
echo.
echo %BLUE%[INFO]%NC% Installing globally...
call npm link
if errorlevel 1 (
    echo %YELLOW%[WARNING]%NC% npm link failed, trying alternative installation...
    
    REM Alternative installation method
    set INSTALL_DIR=%USERPROFILE%\AppData\Local\bin
    if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
    
    REM Create batch file wrapper
    echo @echo off > "%INSTALL_DIR%\ielts-monitor.bat"
    echo node "%~dp0..\share\ielts-appointment-monitor\dist\cli\index.js" %%* >> "%INSTALL_DIR%\ielts-monitor.bat"
    
    REM Copy application files
    set APP_DIR=%USERPROFILE%\AppData\Local\share\%APP_NAME%
    if not exist "%APP_DIR%" mkdir "%APP_DIR%"
    xcopy /E /I /Y dist "%APP_DIR%\dist" >nul
    copy package.json "%APP_DIR%\" >nul
    
    echo %GREEN%[SUCCESS]%NC% Installed to %INSTALL_DIR%\ielts-monitor.bat
    
    REM Check if directory is in PATH
    echo %PATH% | findstr /C:"%INSTALL_DIR%" >nul
    if errorlevel 1 (
        echo %YELLOW%[WARNING]%NC% %INSTALL_DIR% is not in your PATH
        echo You may need to add it manually or use the full path to run ielts-monitor
    )
) else (
    echo %GREEN%[SUCCESS]%NC% Installed globally using npm link
)

REM Test installation
echo.
echo %BLUE%[INFO]%NC% Testing installation...
ielts-monitor --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Installation test failed - command not found
    echo Try running: npm link
    echo Or use the full path to the executable
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('ielts-monitor --version 2^>nul') do set APP_VERSION=%%i
    echo %GREEN%[SUCCESS]%NC% Installation test passed - version: %APP_VERSION%
)

REM Installation complete
echo.
echo %GREEN%╔══════════════════════════════════════════════════════════════╗%NC%
echo %GREEN%║                    Installation Complete!                   ║%NC%
echo %GREEN%╚══════════════════════════════════════════════════════════════╝%NC%
echo.
echo 🎉 IELTS Appointment Monitor has been installed successfully!
echo.
echo 📋 Next steps:
echo   1. Configure your monitoring preferences:
echo      %BLUE%ielts-monitor configure%NC%
echo.
echo   2. Start monitoring:
echo      %BLUE%ielts-monitor start%NC%
echo.
echo   3. Check status:
echo      %BLUE%ielts-monitor status%NC%
echo.
echo 📚 For help and documentation:
echo   • Run: %BLUE%ielts-monitor --help%NC%
echo   • View logs: %BLUE%ielts-monitor logs%NC%
echo   • Read docs: %BLUE%type docs\README.md%NC%
echo.
echo 🐛 Having issues? Check the troubleshooting guide:
echo   %BLUE%type docs\TROUBLESHOOTING.md%NC%
echo.

pause