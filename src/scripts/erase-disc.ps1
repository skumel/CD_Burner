param(
    [int]$RecorderIndex = 0,
    [switch]$FullErase
)

. "$PSScriptRoot\imapi-common.ps1"

try {
    Send-SbEvent -Status 'initializing' -Percent 5 -Stage 'Checking burner and disc'
    $rec = Get-SbRecorder -Index $RecorderIndex

    $erase = New-Object -ComObject IMAPI2.MsftDiscFormat2Erase
    if (-not $erase.IsRecorderSupported($rec)) { throw "This drive can't erase discs." }
    if (-not $erase.IsCurrentMediaSupported($rec)) {
        throw 'The disc in the drive is not rewritable. Only CD-RW / DVD-RW discs can be erased (CD-R cannot).'
    }
    $erase.Recorder = $rec
    $erase.ClientName = 'SonicBurn'
    $erase.FullErase = [bool]$FullErase

    $mode = if ($FullErase) { 'Full erase (10-20 minutes)' } else { 'Quick erase (1-2 minutes)' }
    Send-SbEvent -Status 'erasing' -Percent 20 -Stage "Erasing disc: $mode" -Detail 'Do not eject the disc.'
    $erase.EraseMedia()

    Send-SbEvent -Type 'completed' -Status 'completed' -Percent 100 -Stage 'Disc erased' -Detail 'The disc is blank and ready to burn.'
} catch {
    Send-SbEvent -Type 'error' -Status 'failed' -Message $_.Exception.Message
    exit 1
}
