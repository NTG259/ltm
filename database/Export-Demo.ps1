param([switch]$ApplyToWebsite)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
$buildDb = 'codejudge_demo_build_' + [guid]::NewGuid().ToString('N').Substring(0,8)
$checkDb = $buildDb + '_check'
$containerDir = '/tmp/' + $buildDb
function Compose {
    & docker compose @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $args" }
}
try {
    Compose cp backend/src/main/resources/db "db:$containerDir"
    Compose exec -T db createdb -U codejudge $buildDb
    $migrations = Get-ChildItem backend/src/main/resources/db/migration/V*.sql |
        Sort-Object { [int]([regex]::Match($_.Name, '^V(\d+)').Groups[1].Value) }
    foreach ($migration in $migrations) {
        Compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U codejudge -d $buildDb -f "$containerDir/migration/$($migration.Name)"
    }
    Compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U codejudge -d $buildDb -f "$containerDir/seed/realistic_data.sql"
    # Keep Flyway's exact checksums so the application accepts the restored database.
    Compose exec -T db pg_dump -U codejudge -d codejudge --no-owner --no-privileges --table=public.flyway_schema_history -f "$containerDir/flyway.sql"
    Compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U codejudge -d $buildDb -f "$containerDir/flyway.sql"
    Compose exec -T db pg_dump -U codejudge -d $buildDb --format=custom --compress=6 --no-owner --no-privileges -f "$containerDir/codejudge-demo.db"
    Compose cp "db:$containerDir/codejudge-demo.db" database/codejudge-demo.db
    $size = (Get-Item database/codejudge-demo.db).Length
    if ($size -ge 100000000) { throw 'Demo archive exceeds the 100 MB budget.' }
    Compose exec -T db createdb -U codejudge $checkDb
    Compose exec -T db pg_restore -U codejudge -d $checkDb --no-owner --no-privileges --exit-on-error "$containerDir/codejudge-demo.db"
    Compose exec -T db psql -X -v ON_ERROR_STOP=1 -U codejudge -d $checkDb -c "SELECT 'users' AS entity,count(*) FROM users UNION ALL SELECT 'classrooms',count(*) FROM classrooms UNION ALL SELECT 'contests',count(*) FROM contests UNION ALL SELECT 'participants',count(*) FROM contest_participants UNION ALL SELECT 'submissions',count(*) FROM submissions UNION ALL SELECT 'sessions',count(*) FROM sessions;"
    if ($ApplyToWebsite) {
        Compose exec -T db psql -X -v ON_ERROR_STOP=1 -U codejudge -d codejudge -f "$containerDir/seed/realistic_data.sql"
    }
    Write-Host "Verified database/codejudge-demo.db ($size bytes)."
} finally {
    # Only drop the two randomly named databases created by this script.
    & docker compose exec -T db dropdb -U codejudge --if-exists $checkDb
    & docker compose exec -T db dropdb -U codejudge --if-exists $buildDb
}
