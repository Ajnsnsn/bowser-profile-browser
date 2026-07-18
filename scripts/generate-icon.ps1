param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $projectRoot 'build'
}
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )
  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-BowserBaseIcon {
  param([int]$Size = 1024)

  $scale = $Size / 512.0
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $shadowRect = [System.Drawing.RectangleF]::new(30 * $scale, 38 * $scale, 452 * $scale, 452 * $scale)
  $shadowPath = New-RoundedRectanglePath -Rectangle $shadowRect -Radius (105 * $scale)
  $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(65, 32, 18, 88))
  $graphics.FillPath($shadowBrush, $shadowPath)

  $backgroundRect = [System.Drawing.RectangleF]::new(24 * $scale, 22 * $scale, 464 * $scale, 464 * $scale)
  $backgroundPath = New-RoundedRectanglePath -Rectangle $backgroundRect -Radius (105 * $scale)
  $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $backgroundRect,
    [System.Drawing.Color]::FromArgb(255, 151, 112, 255),
    [System.Drawing.Color]::FromArgb(255, 68, 45, 190),
    48.0
  )
  $graphics.FillPath($backgroundBrush, $backgroundPath)

  $glowRect = [System.Drawing.RectangleF]::new(30 * $scale, 25 * $scale, 355 * $scale, 270 * $scale)
  $glowPath = New-RoundedRectanglePath -Rectangle $glowRect -Radius (95 * $scale)
  $glowBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $glowRect,
    [System.Drawing.Color]::FromArgb(125, 90, 224, 255),
    [System.Drawing.Color]::FromArgb(0, 90, 224, 255),
    125.0
  )
  $graphics.FillPath($glowBrush, $glowPath)

  $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(105, 229, 222, 255), 3.5 * $scale)
  $graphics.DrawPath($borderPen, $backgroundPath)

  $outerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(245, 255, 255, 255), 24 * $scale)
  $outerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $outerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($outerPen, 116 * $scale, 116 * $scale, 280 * $scale, 280 * $scale, -73, 303)

  $accentPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 91, 225, 246), 17 * $scale)
  $accentPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $accentPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($accentPen, 151 * $scale, 151 * $scale, 210 * $scale, 210 * $scale, 20, 232)

  $innerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(232, 224, 216, 255), 17 * $scale)
  $innerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $innerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($innerPen, 184 * $scale, 184 * $scale, 144 * $scale, 144 * $scale, -100, 286)

  $coreRect = [System.Drawing.RectangleF]::new(222 * $scale, 222 * $scale, 68 * $scale, 68 * $scale)
  $coreBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $coreRect,
    [System.Drawing.Color]::FromArgb(255, 107, 239, 216),
    [System.Drawing.Color]::FromArgb(255, 87, 186, 255),
    45.0
  )
  $graphics.FillEllipse($coreBrush, $coreRect)
  $coreHighlight = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 255, 255, 255))
  $graphics.FillEllipse($coreHighlight, 239 * $scale, 234 * $scale, 18 * $scale, 18 * $scale)

  $graphics.Dispose()
  $shadowBrush.Dispose()
  $shadowPath.Dispose()
  $backgroundBrush.Dispose()
  $backgroundPath.Dispose()
  $glowBrush.Dispose()
  $glowPath.Dispose()
  $borderPen.Dispose()
  $outerPen.Dispose()
  $accentPen.Dispose()
  $innerPen.Dispose()
  $coreBrush.Dispose()
  $coreHighlight.Dispose()
  return $bitmap
}

function Resize-IconBitmap {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$Size
  )
  $target = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($Source, [System.Drawing.Rectangle]::new(0, 0, $Size, $Size))
  $graphics.Dispose()
  return $target
}

$baseIcon = New-BowserBaseIcon -Size 1024
$preview = Resize-IconBitmap -Source $baseIcon -Size 512
$pngPath = Join-Path $OutputDirectory 'icon.png'
$preview.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$preview.Dispose()

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngEntries = @()
foreach ($size in $sizes) {
  $resized = Resize-IconBitmap -Source $baseIcon -Size $size
  $stream = [System.IO.MemoryStream]::new()
  $resized.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngEntries += ,$stream.ToArray()
  $stream.Dispose()
  $resized.Dispose()
}
$baseIcon.Dispose()

$icoPath = Join-Path $OutputDirectory 'icon.ico'
$fileStream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = [System.IO.BinaryWriter]::new($fileStream)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$sizes.Count)
$offset = 6 + (16 * $sizes.Count)
for ($index = 0; $index -lt $sizes.Count; $index++) {
  $size = $sizes[$index]
  $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
  $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]32)
  $writer.Write([uint32]$pngEntries[$index].Length)
  $writer.Write([uint32]$offset)
  $offset += $pngEntries[$index].Length
}
foreach ($entry in $pngEntries) {
  $writer.Write($entry)
}
$writer.Flush()
$writer.Dispose()
$fileStream.Dispose()

Write-Host "Generated $icoPath"
Write-Host "Generated $pngPath"
