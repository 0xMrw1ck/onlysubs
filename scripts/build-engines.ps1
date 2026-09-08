$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$engineRoot = Join-Path $projectRoot 'work\engines'
$pythonExe = 'C:\Users\MrMeow\scoop\apps\python\current\python.exe'
$ffmpegRoot = 'C:\Users\MrMeow\scoop\apps\ffmpeg\9.0.1'

New-Item -ItemType Directory -Path $engineRoot -Force | Out-Null
& $pythonExe -m PyInstaller --noconfirm --clean --onedir --name onlysubs-transcriber --distpath $engineRoot --workpath (Join-Path $projectRoot 'work\pyinstaller') --specpath (Join-Path $projectRoot 'work') --collect-all faster_whisper --collect-all ctranslate2 --collect-all tokenizers --collect-all av --collect-all onnxruntime (Join-Path $projectRoot 'server\transcribe.py')
if ($LASTEXITCODE -ne 0) { throw 'Transcriber packaging failed' }

Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'bin\ffmpeg.exe') -Destination (Join-Path $engineRoot 'ffmpeg.exe') -Force
Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'bin\ffprobe.exe') -Destination (Join-Path $engineRoot 'ffprobe.exe') -Force
Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'LICENSE') -Destination (Join-Path $engineRoot 'FFMPEG-GPL-3.0.txt') -Force
Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'README.txt') -Destination (Join-Path $engineRoot 'FFMPEG-BUILD-INFO.txt') -Force
Copy-Item -LiteralPath 'C:\Users\MrMeow\scoop\apps\python\current\LICENSE.txt' -Destination (Join-Path $engineRoot 'PYTHON-LICENSE.txt') -Force
& $pythonExe (Join-Path $projectRoot 'scripts\engine_notices.py') (Join-Path $engineRoot 'PYTHON-ENGINE-NOTICES.txt')
if ($LASTEXITCODE -ne 0) { throw 'Engine notice generation failed' }

& (Join-Path $engineRoot 'onlysubs-transcriber\onlysubs-transcriber.exe') --health
if ($LASTEXITCODE -ne 0) { throw 'Bundled transcriber check failed' }
& (Join-Path $engineRoot 'ffmpeg.exe') -version | Select-Object -First 1
if ($LASTEXITCODE -ne 0) { throw 'Bundled FFmpeg check failed' }
