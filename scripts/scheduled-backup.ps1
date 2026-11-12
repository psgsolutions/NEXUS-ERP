# สำรองข้อมูล Firestore ประจำวัน (ฟรี ไม่ต้องใช้แพ็กเกจ Blaze) — เรียกจาก Windows Task Scheduler
#   ปลุกเครื่องมาทำงาน และลองใหม่ 3 ครั้งเมื่อล้มเหลว
#   1) node scripts/backup-firestore.mjs  -> backups/firestore-<project>-<วันเวลา>.jsonl.gz (อ่านอย่างเดียว)
#   2) คัดลอกไฟล์ใหม่ไปโฟลเดอร์สำรองนอกเครื่อง (เช่น Google Drive)
#   3) ลบไฟล์สำรองที่เก่ากว่า -KeepDays วัน (เฉพาะไฟล์ชื่อ firestore-*.jsonl.gz ในสองโฟลเดอร์นี้)
#   บันทึกผลที่ backups/backup-log.txt
# ตั้งเวลา:  powershell -ExecutionPolicy Bypass -File scripts\scheduled-backup.ps1 -Register
param(
  [string]$Repo = "D:\NEXUS-ERP",
  [string]$CopyTo = "G:\My Drive\NEXUS-ERP-Backup",
  [int]$KeepDays = 14,
  [string]$At = "12:30",
  [switch]$Register
)
$ErrorActionPreference = "Stop"
$taskName = "NEXUS-ERP Firestore Backup"

if ($Register) {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Repo\scripts\scheduled-backup.ps1`" -Repo `"$Repo`" -CopyTo `"$CopyTo`" -KeepDays $KeepDays"
  $trigger = New-ScheduledTaskTrigger -Daily -At $At
  # เครื่องปิดอยู่ตอนถึงเวลา = รันทันทีเมื่อเปิดเครื่อง · ใช้ไฟฟ้าแบตก็รัน · จำกัดเวลา 30 นาที
  # ปลุกเครื่องจาก sleep มาสำรอง · ล้มเหลว (เช่น เครื่องเพิ่งตื่นแล้วถูกตัด) ลองใหม่ทุก 10 นาที 3 ครั้ง
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "สำรองข้อมูล NEXUS ERP ทุกวัน เก็บ $KeepDays วัน ที่ $Repo\backups และ $CopyTo" -Force | Out-Null
  Write-Output "ตั้งเวลาแล้ว: '$taskName' ทุกวัน $At"
  exit 0
}

$backupDir = Join-Path $Repo "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$log = Join-Path $backupDir "backup-log.txt"
function Log($m) { Add-Content -Path $log -Value ("{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) -Encoding UTF8 }

try {
  Set-Location $Repo
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { $node = "C:\Program Files\nodejs\node.exe" }
  $started = Get-Date
  & $node "scripts/backup-firestore.mjs" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "backup-firestore.mjs exit $LASTEXITCODE" }
  $file = Get-ChildItem $backupDir -Filter "firestore-*.jsonl.gz" | Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-5) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $file -or $file.Length -lt 1000) { throw "ไม่พบไฟล์สำรองใหม่ หรือไฟล์เล็กผิดปกติ" }
  $copied = "ไม่ได้คัดลอก"
  if ($CopyTo) {
    try { New-Item -ItemType Directory -Force -Path $CopyTo | Out-Null; Copy-Item $file.FullName -Destination $CopyTo -Force; $copied = "คัดลอกไป $CopyTo" }
    catch { $copied = "คัดลอกไม่สำเร็จ: $($_.Exception.Message)" }
  }
  $cut = (Get-Date).AddDays(-$KeepDays); $removed = 0
  foreach ($dir in @($backupDir, $CopyTo)) {
    if ($dir -and (Test-Path $dir)) {
      Get-ChildItem $dir -Filter "firestore-*.jsonl.gz" | Where-Object { $_.LastWriteTime -lt $cut } | ForEach-Object { Remove-Item $_.FullName -Force; $removed++ }
    }
  }
  Log ("สำเร็จ {0} ({1:N0} KB) · {2} · ลบไฟล์เก่า {3} ไฟล์" -f $file.Name, ($file.Length / 1KB), $copied, $removed)
} catch {
  Log ("ล้มเหลว: " + $_.Exception.Message)
  exit 1
}
