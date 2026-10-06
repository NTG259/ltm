@echo off
echo Khoi chay 3 Judge Workers song song...
start "Judge Worker 1" cmd /k "set PYTHONUTF8=1 && python -m judgement worker --id worker-1 --master-host 127.0.0.1 --master-port 9000"
start "Judge Worker 2" cmd /k "set PYTHONUTF8=1 && python -m judgement worker --id worker-2 --master-host 127.0.0.1 --master-port 9000"
start "Judge Worker 3" cmd /k "set PYTHONUTF8=1 && python -m judgement worker --id worker-3 --master-host 127.0.0.1 --master-port 9000"
