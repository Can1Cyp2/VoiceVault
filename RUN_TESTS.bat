@echo off
REM ============================================================
REM  VoiceVault test runner
REM  Double-click this file (or run it from a terminal) to run
REM  the full test suite with a clear pass/fail summary.
REM ============================================================
cd /d "%~dp0"

echo.
echo Running VoiceVault tests...
echo.

call npm test -- --verbose

echo.
if %errorlevel%==0 (
  echo ==================================================
  echo    ALL TESTS PASSED
  echo ==================================================
) else (
  echo ==================================================
  echo    SOME TESTS FAILED - scroll up for the red X's
  echo ==================================================
)
echo.
pause
