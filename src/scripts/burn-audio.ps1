param(
    [int]$RecorderIndex = 0,
    [string]$ManifestPath,
    [switch]$TestRun,
    [switch]$EjectOnCompletion,
    [int]$Speed = 0
)

# Audio CD (Red Book CD-DA) via IMAPI2 Track-At-Once.
# Each manifest track's pcmPath must be raw 44.1 kHz / 16-bit / stereo little-endian PCM
# (no WAV header), padded to a multiple of 2352 bytes. Node prepares these with ffmpeg.
# Note: Track-At-Once always writes a 2-second gap before each track.

. "$PSScriptRoot\imapi-common.ps1"
$isTest = [bool]$TestRun
$prepared = $false

try {
    Send-SbEvent -Status 'initializing' -Percent 30 -Stage 'Checking burner and disc' -TestRun $isTest
    $manifest = Get-Content -Raw -LiteralPath $ManifestPath -Encoding UTF8 | ConvertFrom-Json
    $tracks = @($manifest.tracks)
    if ($tracks.Count -eq 0) { throw 'No tracks to burn.' }
    if ($tracks.Count -gt 99) { throw "Audio CDs can hold at most 99 tracks (you selected $($tracks.Count))." }

    $rec = Get-SbRecorder -Index $RecorderIndex
    $tao = New-Object -ComObject IMAPI2.MsftDiscFormat2TrackAtOnce
    if (-not $tao.IsRecorderSupported($rec)) { throw "This drive can't burn audio CDs." }
    if (-not $tao.IsCurrentMediaSupported($rec)) {
        throw 'Audio CDs need a blank CD-R (or CD-RW). DVDs cannot be used for audio CDs.'
    }
    $tao.Recorder = $rec
    $tao.ClientName = 'SonicBurn'
    # DoNotFinalizeMedia defaults to False (disc gets finalized); it can't be set before PrepareMedia().

    # Blank check (via the data format, which exposes it reliably)
    $df = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
    $df.Recorder = $rec
    if (-not $df.MediaHeuristicallyBlank) {
        throw 'The disc in the drive is not blank. Insert a blank CD-R, or use Erase Disc if it is a CD-RW.'
    }

    # Capacity check: audio sectors are 2352 bytes; each TAO track adds a 150-sector (2 s) gap.
    $needed = [int64]0
    foreach ($t in $tracks) {
        if (-not (Test-Path -LiteralPath $t.pcmPath)) { throw "Prepared audio missing: $($t.pcmPath)" }
        $len = (Get-Item -LiteralPath $t.pcmPath).Length
        $needed += [Math]::Ceiling($len / 2352) + 150
    }
    $free = [int64]$df.FreeSectorsOnMedia
    $neededMin = [Math]::Round($needed / 75 / 60, 1)
    $freeMin = [Math]::Round($free / 75 / 60, 1)
    if ($free -gt 0 -and $needed -gt $free) {
        throw "These songs need $neededMin minutes but the disc only holds $freeMin minutes."
    }

    if ($isTest) {
        Send-SbEvent -Type 'completed' -Status 'completed' -Percent 100 -Stage 'Test run passed - nothing was written' `
            -Detail "$($tracks.Count) tracks converted OK; $neededMin of $freeMin minutes used. Untick Test Run to burn for real." -TestRun $true
        exit 0
    }

    $speedSet = $Speed -le 0
    if (-not $speedSet) {
        try { $tao.SetWriteSpeed($Speed * 75, $false); $speedSet = $true } catch {}   # 1x CD = 75 sectors/sec
    }

    Send-SbEvent -Status 'preparing' -Percent 32 -Stage 'Preparing disc for writing'
    $tao.PrepareMedia()
    $prepared = $true
    if (-not $speedSet) { try { $tao.SetWriteSpeed($Speed * 75, $false) } catch {} }

    $n = 0
    foreach ($t in $tracks) {
        $n++
        $pct = [int](32 + (($n - 1) / $tracks.Count) * 63)
        Send-SbEvent -Status 'burning' -Percent $pct -Stage "Burning track $n of $($tracks.Count)" -Detail "$($t.artist) - $($t.title)"
        $stream = [SonicBurn.StreamHelper]::OpenRead($t.pcmPath)
        $tao.AddAudioTrack($stream)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($stream)
    }

    Send-SbEvent -Status 'finalizing' -Percent 96 -Stage 'Finalizing audio CD (writing table of contents)'
    $tao.ReleaseMedia()
    $prepared = $false

    if ($EjectOnCompletion) { try { $rec.EjectMedia() } catch {} }

    Send-SbEvent -Type 'completed' -Status 'completed' -Percent 100 -Stage 'Audio CD burned successfully' `
        -Detail "$($tracks.Count) tracks, $neededMin minutes."
} catch {
    $msg = $_.Exception.Message
    if ($prepared) { try { $tao.ReleaseMedia() } catch {} }
    Send-SbEvent -Type 'error' -Status 'failed' -Message $msg -TestRun $isTest
    exit 1
}
