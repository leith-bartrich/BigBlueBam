@echo off
rem Thin wrapper so users can double-click or run `scripts\deploy.bat` from cmd.exe.
rem All the real logic lives in deploy.ps1.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
