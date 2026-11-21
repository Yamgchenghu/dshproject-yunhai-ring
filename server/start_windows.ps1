param(
  [string]$GptDir = "",
  [string]$ApiKey = ""
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $GptDir) {
  $candidates = @(
    (Join-Path $Root "GPT-SoVITS"),
    (Join-Path $Root "..\GPT-SoVITS"),
    (Join-Path $Root "..\GPT-SoVITS-v4"),
    (Join-Path $Root "..\GPT-SoVITS-integrated")
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c "api_v2.py")) { $GptDir = (Resolve-Path $c).Path; break }
  }
}
if (-not $GptDir -or -not (Test-Path (Join-Path $GptDir "api_v2.py"))) {
  Write-Host ""
  Write-Host "找不到 GPT-SoVITS 的 api_v2.py。" -ForegroundColor Yellow
  Write-Host "用法：右键“使用 PowerShell 运行”，或执行："
  Write-Host '  powershell -ExecutionPolicy Bypass -File start_windows.ps1 -GptDir "D:\GPT-SoVITS"'
  Write-Host ""
  Read-Host "按回车退出"
  exit 1
}

$py = Join-Path $GptDir "runtime\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
if ($ApiKey) { $env:CLONE_API_KEY = $ApiKey }

Write-Host "GPT-SoVITS : $GptDir"
Write-Host "Python     : $py"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "提示：未找到 ffmpeg，mp3/m4a 等格式将无法上传，只能上传 wav。" -ForegroundColor Yellow
  Write-Host "      Windows 可执行：winget install Gyan.FFmpeg" -ForegroundColor Yellow
}

$apiArgs = @('"' + (Join-Path $GptDir "api_v2.py") + '"', "-a", "127.0.0.1", "-p", "9880")
$cfg = Join-Path $GptDir "GPT_SoVITS\configs\tts_infer.yaml"
if (Test-Path $cfg) { $apiArgs += @("-c", '"' + $cfg + '"') }

Write-Host "启动 GPT-SoVITS API（最小化窗口）..."
Start-Process -FilePath $py -ArgumentList $apiArgs -WorkingDirectory $GptDir -WindowStyle Minimized
Start-Sleep -Seconds 10

Write-Host "启动克隆服务：http://0.0.0.0:9881"
Write-Host "手机访问地址见下方输出的「手机访问」。"
Write-Host "按 Ctrl+C 停止克隆服务。"
& $py (Join-Path $Root "clone_server.py") --host 0.0.0.0 --port 9881 --gpt http://127.0.0.1:9880 --data (Join-Path $Root "voices")
