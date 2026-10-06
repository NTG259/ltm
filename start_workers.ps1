# Khoi chay 3 Judge Workers song song tren Windows PowerShell
1..3 | ForEach-Object {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONUTF8='1'; Write-Host '>>> Judge Worker $_ da ket noi' -ForegroundColor Cyan; python -m judgement worker --id worker-`$_ --master-host 127.0.0.1 --master-port 9000"
}
Write-Host "Da khoi chay xong 3 Worker trong 3 cua so rieng biet!" -ForegroundColor Green
