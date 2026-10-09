@echo off
cd /d "%~dp0"
echo Starting MazeLab v2.1 on http://localhost:8000
where py >nul 2>nul
if %errorlevel%==0 (
  start "MazeLab server" cmd /k "py -3 -m http.server 8000"
) else (
  start "MazeLab server" cmd /k "python -m http.server 8000"
)
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"
echo Close the MazeLab server window when you are finished.
