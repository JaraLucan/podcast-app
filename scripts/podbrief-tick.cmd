@echo off
REM PodBrief background worker — ensures Ollama is up, then runs one pipeline
REM tick. Registered as a Scheduled Task ("PodBriefTick") that fires every 5
REM minutes so the backlog drains on its own, with no Claude Code / open app.
setlocal
set "OLLAMA_HOST=127.0.0.1:11434"
set "OLLAMA_NUM_PARALLEL=2"
set "OLLAMA_FLASH_ATTENTION=1"
set "OLLAMA_KEEP_ALIVE=30m"
set "TICK_MAX_JOBS=3"
cd /d "C:\Users\jaral\podcast_app"

REM Ensure the local Ollama server is running; start it hidden+detached if not.
curl -s -o NUL -m 3 http://127.0.0.1:11434/api/tags
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath 'C:\Users\jaral\AppData\Local\Programs\Ollama\ollama.exe' -ArgumentList 'serve' -WindowStyle Hidden"
  ping -n 8 127.0.0.1 >NUL
)

REM Run one pipeline tick (drains up to TICK_MAX_JOBS jobs), append to log.
echo [%date% %time%] tick start >> "C:\Users\jaral\podcast_app\tick-cron.log"
call "C:\Users\jaral\AppData\Roaming\npm\pnpm.cmd" tick >> "C:\Users\jaral\podcast_app\tick-cron.log" 2>&1
echo [%date% %time%] tick end >> "C:\Users\jaral\podcast_app\tick-cron.log"
endlocal
