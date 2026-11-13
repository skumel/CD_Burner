param(
    [int]$RecorderIndex = 0,
    [string]$VolumeLabel = 'MP3_DISC',
    [string]$ManifestPath,
    [switch]$TestRun,
    [switch]$EjectOnCompletion,
    [int]$Speed = 0
)

. "$PSScriptRoot\imapi-common.ps1"
$isTest = [bool]$TestRun

try {
    Send-SbEvent -Status 'initializing' -Percent 2 -Stage 'Checking burner and disc' -TestRun $isTest
    $manifest = Get-Content -Raw -LiteralPath $ManifestPath -Encoding UTF8 | ConvertFrom-Json

    $rec = Get-SbRecorder -Index $RecorderIndex
    $df = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
    if (-not $df.IsRecorderSupported($rec)) { throw "This drive can't write data discs." }
    if (-not $df.IsCurrentMediaSupported($rec)) {
        throw 'No writable disc found. Insert a blank CD-R, CD-RW, DVD-R or DVD+R and click refresh.'
    }
    $df.Recorder = $rec
    $df.ClientName = 'SonicBurn'
    $df.ForceMediaToBeClosed = $true   # finalize so car stereos / other players can read it

    if (-not $df.MediaHeuristicallyBlank) {
        throw 'The disc in the drive is not blank. Insert a blank disc, or use Erase Disc if it is a CD-RW.'
    }

    $freeSectors = [int64]$df.FreeSectorsOnMedia
    Send-SbEvent -Status 'building' -Percent 8 -Stage 'Building disc layout (ISO9660 + Joliet + UDF)' `
        -Detail "Disc has $([Math]::Round($freeSectors * 2048 / 1MB, 1)) MB free" -TestRun $isTest

    $img = New-SbFileSystemImage -Files $manifest.files -VolumeLabel $VolumeLabel -Recorder $rec -StartPercent 10 -EndPercent 30

    Send-SbEvent -Status 'building' -Percent 32 -Stage 'Creating disc image' -TestRun $isTest
    try {
        $result = $img.Fsi.CreateResultImage()
    } catch {
        throw "The selected files don't fit on this disc. Remove some songs and try again. ($($_.Exception.Message))"
    }
    $neededMb = [Math]::Round($result.TotalBlocks * 2048 / 1MB, 1)
    $freeMb = [Math]::Round($freeSectors * 2048 / 1MB, 1)
    if ($result.TotalBlocks -gt $freeSectors) {
        throw "Needs $neededMb MB but the disc only has $freeMb MB free."
    }

    if ($isTest) {
        Send-SbEvent -Type 'completed' -Status 'completed' -Percent 100 -Stage 'Test run passed - nothing was written' `
            -Detail "$($img.Count) files ($neededMb MB) fit on the disc ($freeMb MB free). Untick Test Run to burn for real." -TestRun $true
        exit 0
    }

    if ($Speed -gt 0) {
        try { $df.SetWriteSpeed($Speed * 75, $false) } catch {}   # 1x CD = 75 sectors/sec; drive picks nearest supported
    }

    Send-SbEvent -Status 'burning' -Percent 35 -Stage "Burning $neededMb MB to disc..." `
        -Detail 'This can take several minutes. Do not eject the disc or close the app.'
    $df.Write($result.ImageStream)

    Send-SbEvent -Status 'finalizing' -Percent 97 -Stage 'Finalizing disc'
    if ($EjectOnCompletion) { try { $rec.EjectMedia() } catch {} }

    Send-SbEvent -Type 'completed' -Status 'completed' -Percent 100 -Stage 'Data disc burned successfully' `
        -Detail "$($img.Count) files ($neededMb MB) written."
} catch {
    Send-SbEvent -Type 'error' -Status 'failed' -Message $_.Exception.Message -TestRun $isTest
    exit 1
}
