# Shared helpers for SonicBurn IMAPI2 scripts. Dot-source this file.
$ErrorActionPreference = 'Stop'

if (-not ('SonicBurn.StreamHelper' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

namespace SonicBurn {
    public static class StreamHelper {
        [DllImport("shlwapi.dll", CharSet = CharSet.Unicode, ExactSpelling = true, PreserveSig = false)]
        private static extern void SHCreateStreamOnFileEx(string pszFile, uint grfMode, uint dwAttributes,
            [MarshalAs(UnmanagedType.Bool)] bool fCreate, IntPtr pstmTemplate, out IStream ppstm);

        // Opens a file as a COM IStream (read-only, others may still read). IMAPI2 reads it lazily while burning.
        public static object OpenRead(string path) {
            IStream s;
            SHCreateStreamOnFileEx(path, 0x00000020 /* STGM_READ | STGM_SHARE_DENY_WRITE */, 0, false, IntPtr.Zero, out s);
            return s;
        }

        // Copies a COM IStream (e.g. an IMAPI2 result image) to a file on disk.
        public static long SaveToFile(object comStream, string path) {
            IStream s = (IStream)comStream;
            byte[] buf = new byte[1024 * 1024];
            IntPtr pcb = Marshal.AllocHGlobal(sizeof(int));
            long total = 0;
            try {
                using (FileStream fs = File.Create(path)) {
                    while (true) {
                        s.Read(buf, buf.Length, pcb);
                        int n = Marshal.ReadInt32(pcb);
                        if (n <= 0) break;
                        fs.Write(buf, 0, n);
                        total += n;
                    }
                }
            } finally {
                Marshal.FreeHGlobal(pcb);
            }
            return total;
        }
    }
}
'@
}

function Send-SbEvent {
    param(
        [string]$Type = 'progress',
        [string]$Status = '',
        [int]$Percent = 0,
        [string]$Stage = '',
        [string]$Detail = '',
        [string]$Message = '',
        [bool]$TestRun = $false
    )
    $obj = [ordered]@{
        type    = $Type
        status  = $Status
        percent = $Percent
        stage   = $Stage
        detail  = $Detail
        message = $Message
        testRun = $TestRun
    }
    # One JSON object per line; Node parses line by line.
    [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
}

function Get-SbRecorder {
    param([int]$Index)
    $dm = New-Object -ComObject IMAPI2.MsftDiscMaster2
    if ($dm.Count -eq 0) { throw 'No CD/DVD burner was found on this computer.' }
    if ($Index -ge $dm.Count) { throw "Burner #$Index not found (only $($dm.Count) available)." }
    $rec = New-Object -ComObject IMAPI2.MsftDiscRecorder2
    $rec.InitializeDiscRecorder($dm.Item($Index))
    return $rec
}

# Builds an ISO9660 + Joliet + UDF file system image from a manifest of
# { sourcePath, discRelativePath } entries. Returns @{ Fsi; Streams; Count }.
# Streams must stay referenced until the burn/save has finished.
function New-SbFileSystemImage {
    param(
        $Files,
        [string]$VolumeLabel,
        $Recorder = $null,
        [int]$StartPercent = 10,
        [int]$EndPercent = 30
    )
    $fsi = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
    if ($Recorder) {
        $fsi.ChooseImageDefaults($Recorder)   # sizes the image to the disc in the drive
    } else {
        $fsi.FreeMediaBlocks = 0              # 0 = no size limit (ISO export)
    }
    $fsi.FileSystemsToCreate = 7              # ISO9660 (1) + Joliet (2) + UDF (4)
    $fsi.VolumeName = $VolumeLabel

    $streams = New-Object System.Collections.ArrayList
    $total = @($Files).Count
    $i = 0
    foreach ($f in $Files) {
        $i++
        if (-not (Test-Path -LiteralPath $f.sourcePath)) {
            throw "File not found: $($f.sourcePath)"
        }
        $rel = $f.discRelativePath.TrimStart('\')
        $dir = Split-Path $rel -Parent
        if ($dir) {
            $cur = ''
            foreach ($seg in $dir.Split('\')) {
                if (-not $seg) { continue }
                $cur = if ($cur) { "$cur\$seg" } else { $seg }
                if ($fsi.Exists("\$cur") -eq 0) { $fsi.Root.AddDirectory($cur) }
            }
        }
        $stream = [SonicBurn.StreamHelper]::OpenRead($f.sourcePath)
        [void]$streams.Add($stream)
        $fsi.Root.AddFile($rel, $stream)

        $pct = [int]($StartPercent + ($i / [Math]::Max(1, $total)) * ($EndPercent - $StartPercent))
        Send-SbEvent -Status 'building' -Percent $pct -Stage "Adding files to disc layout ($i of $total)" -Detail (Split-Path $rel -Leaf)
    }
    return @{ Fsi = $fsi; Streams = $streams; Count = $total }
}
