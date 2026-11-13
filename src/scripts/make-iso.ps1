param(
    [string]$ManifestPath,
    [string]$OutputPath,
    [string]$VolumeLabel = 'MP3_DISC'
)

. "$PSScriptRoot\imapi-common.ps1"

try {
    Send-SbEvent -Status 'initializing' -Percent 2 -Stage 'Preparing ISO image builder'
    $manifest = Get-Content -Raw -LiteralPath $ManifestPath -Encoding UTF8 | ConvertFrom-Json

    $img = New-SbFileSystemImage -Files $manifest.files -VolumeLabel $VolumeLabel -StartPercent 5 -EndPercent 50

    Send-SbEvent -Status 'generating' -Percent 55 -Stage 'Generating ISO image'
    $result = $img.Fsi.CreateResultImage()
    $sizeMb = [Math]::Round($result.TotalBlocks * 2048 / 1MB, 1)

    $outDir = Split-Path $OutputPath -Parent
    if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }

    Send-SbEvent -Status 'saving' -Percent 60 -Stage "Writing $sizeMb MB ISO file" -Detail $OutputPath
    $written = [SonicBurn.StreamHelper]::SaveToFile($result.ImageStream, $OutputPath)

    Send-SbEvent -Type 'completed' -Status 'completed' -Percent 100 -Stage 'ISO image saved' `
        -Detail "$($img.Count) files, $([Math]::Round($written / 1MB, 1)) MB -> $OutputPath"
} catch {
    Send-SbEvent -Type 'error' -Status 'failed' -Message $_.Exception.Message
    exit 1
}
