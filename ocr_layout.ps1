$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }) | Select-Object -First 1

function Await($op, $type) {
  $asTask = $asTaskGeneric.MakeGenericMethod($type)
  $task = $asTask.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$imgPath = Join-Path $PSScriptRoot 'ChatGPT Image 3 sept. 2026, 16_39_49.png'
$outPath = Join-Path $PSScriptRoot 'ocr_out.txt'

if (-not (Test-Path $imgPath)) { throw "Image introuvable : $imgPath" }

$imgFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imgPath)) ([Windows.Storage.StorageFile])
$stream = Await $imgFile.OpenAsync([Windows.Storage.FileAccessMode]::Read) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await $decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied) ([Windows.Graphics.Imaging.SoftwareBitmap])

$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $ocrEngine) { throw 'Moteur OCR indisponible' }
$ocrResult = Await $ocrEngine.RecognizeAsync($bitmap) ([Windows.Media.Ocr.OcrResult])

$lines = $ocrResult.Lines |
  Sort-Object { $_.BoundingRect.Y } |
  ForEach-Object { '{0,5:N0}  y={1,5:N0}  {2}' -f $_.BoundingRect.X, $_.BoundingRect.Y, $_.Text }

$lines | Set-Content $outPath
Write-Host "OCR OK : $($ocrResult.Lines.Count) lignes"
