# Queue all unoptimized / missing-HLS videos for background compress + adaptive HLS.
#
# Usage (PowerShell):
#   $env:ADMIN_EMAIL = 'admin@example.com'
#   $env:ADMIN_PASSWORD = 'your-password'
#   .\optimize-all-videos.ps1
#
# Optional:
#   $env:API_BASE = 'https://api.drsalahalzait.me/api/v1'
#   $env:ACCESS_TOKEN = 'eyJ...'   # skip login

$ErrorActionPreference = 'Stop'

$ApiBase = if ($env:API_BASE) { $env:API_BASE } else { 'https://api.drsalahalzait.me/api/v1' }
$DeviceId = if ($env:DEVICE_ID) { $env:DEVICE_ID } else { 'optimize-script' }
$DeviceName = if ($env:DEVICE_NAME) { $env:DEVICE_NAME } else { 'optimize-all-videos.ps1' }

Write-Host "API: $ApiBase"

$token = $env:ACCESS_TOKEN
if (-not $token) {
  if (-not $env:ADMIN_EMAIL -or -not $env:ADMIN_PASSWORD) {
    Write-Host "Set ADMIN_EMAIL and ADMIN_PASSWORD, or ACCESS_TOKEN."
    Write-Host "Example:"
    Write-Host '  $env:ADMIN_EMAIL="admin@you.com"; $env:ADMIN_PASSWORD="***"; .\optimize-all-videos.ps1'
    exit 1
  }

  Write-Host "Logging in as $($env:ADMIN_EMAIL) ..."
  $loginBody = @{
    email      = $env:ADMIN_EMAIL
    password   = $env:ADMIN_PASSWORD
    deviceId   = $DeviceId
    deviceName = $DeviceName
  } | ConvertTo-Json

  $login = Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/login" `
    -ContentType 'application/json' -Body $loginBody

  $token = $login.accessToken
  if (-not $token) {
    Write-Host "Login failed:"
    $login | ConvertTo-Json -Depth 6
    exit 1
  }
  Write-Host "Login OK"
}

Write-Host "Queueing optimize-all ..."
$headers = @{ Authorization = "Bearer $token" }
$result = Invoke-RestMethod -Method Post -Uri "$ApiBase/admin/videos/optimize-all" -Headers $headers
$result | ConvertTo-Json -Depth 6

Write-Host ""
Write-Host "Done. Watch API logs for optimize progress."
Write-Host "  docker compose logs -f api"
