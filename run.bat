@echo off
setlocal enabledelayedexpansion
title Forensic Sketch - Unified Launcher

echo =======================================================
echo 🕵️  Forensic Sketch System: Environment Setup
echo =======================================================

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found! Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

:: 1b. Optional: Clean Start (Kill stale processes)
set /p clean="🧹 Clean start? (Kill existing Python processes to avoid stale code) [y/N]: "
if /i "%clean%"=="y" (
    echo 🔪 Killing all Python processes...
    taskkill /F /IM python.exe /T >nul 2>&1
)

:: 2. Setup Virtual Environment
if not exist "venv" (
    echo 📦 Virtual environment not found. Creating 'venv'...
    python -m venv venv
    if !errorlevel! neq 0 (
        echo ❌ Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo 📥 Installing Python dependencies...
    call venv\Scripts\activate
    pip install -r requirements.txt
    if !errorlevel! neq 0 (
        echo ❌ Failed to install Python dependencies.
        pause
        exit /b 1
    )
) else (
    echo ✅ Virtual environment exists.
)

:: 3. Setup Node Modules
if not exist "node_modules" (
    echo 📦 Node modules not found. Installing...
    call npm install
    if !errorlevel! neq 0 (
        echo ❌ Failed to install Node dependencies.
        pause
        exit /b 1
    )
) else (
    echo ✅ Node modules exist.
)

echo =======================================================
echo 🚀 Launching Forensic Sketch System
echo =======================================================

:: Start Backend in a new window
echo 🧠 Starting Neural Transformer Backend...
start "Forensic Backend" cmd /k "call venv\Scripts\activate && python server/main.py"

:: Give backend a moment to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend in a new window
echo 🎨 Starting Face Trace Frontend...
set BROWSER=none
npm start

echo =======================================================
echo System is initializing. Check the new windows for status.
echo =======================================================
pause