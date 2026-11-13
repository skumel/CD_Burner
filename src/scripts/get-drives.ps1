param()

$ErrorActionPreference = 'SilentlyContinue'

# 1. Get Physical Storage Drives (Hard drives / SSDs / USBs for MP3 scanning)
$storageDrives = @()
Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in @(2, 3) } | ForEach-Object {
    $storageDrives += [PSCustomObject]@{
        DeviceID = $_.DeviceID
        VolumeName = if ($_.VolumeName) { $_.VolumeName } else { "Local Disk" }
        DriveType = $_.DriveType
        TotalSize = $_.Size
        FreeSpace = $_.FreeSpace
    }
}

# 2. Get Optical Recorders (CD / DVD / BD burners) via IMAPI2
$opticalDrives = @()
try {
    $dm = New-Object -ComObject IMAPI2.MsftDiscMaster2
    for ($i = 0; $i -lt $dm.Count; $i++) {
        $id = $dm.Item($i)
        $rec = New-Object -ComObject IMAPI2.MsftDiscRecorder2
        $rec.InitializeDiscRecorder($id)
        $driveLetter = ($rec.VolumePathNames -join ',').TrimEnd('\')
        
        $mediaType = "No Disc Inserted"
        $isBlank = $false
        $totalBytes = 0
        $freeBytes = 0
        $supportedMedia = @()

        try {
            $df = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
            if ($df.IsRecorderSupported($rec)) {
                $df.Recorder = $rec
                $isBlank = [bool]($df.MediaHeuristicallyBlank -or $df.MediaPhysicallyBlank)
                $rawMediaType = $df.CurrentPhysicalMediaType
                
                # Map IMAPI_MEDIA_PHYSICAL_TYPE enum
                switch ($rawMediaType) {
                    0 { $mediaType = "Unknown / No Media" }
                    1 { $mediaType = "CD-ROM" }
                    2 { $mediaType = "CD-R" }
                    3 { $mediaType = "CD-RW" }
                    4 { $mediaType = "DVD-ROM" }
                    5 { $mediaType = "DVD-RAM" }
                    6 { $mediaType = "DVD-R" }
                    7 { $mediaType = "DVD-RW" }
                    8 { $mediaType = "DVD-R Dual Layer" }
                    9 { $mediaType = "DVD+R" }
                    10 { $mediaType = "DVD+RW" }
                    11 { $mediaType = "DVD+R Dual Layer" }
                    12 { $mediaType = "BD-ROM" }
                    13 { $mediaType = "BD-R" }
                    14 { $mediaType = "BD-RE" }
                    default { $mediaType = "Media ($rawMediaType)" }
                }

                $totalBytes = [int64]$df.TotalSectorsOnMedia * 2048
                $freeBytes = [int64]$df.FreeSectorsOnMedia * 2048
            }
        } catch {
            $mediaType = "No Disc Inserted"
        }

        $opticalDrives += [PSCustomObject]@{
            Index = $i
            Id = $id
            Vendor = $rec.VendorId.Trim()
            Product = $rec.ProductId.Trim()
            Revision = $rec.ProductRevision.Trim()
            DriveLetter = $driveLetter
            MediaType = $mediaType
            IsBlank = $isBlank
            TotalCapacity = $totalBytes
            FreeSpace = $freeBytes
        }
    }
} catch {
    # If IMAPI2 COM fails, fallback to WMI
    Get-CimInstance Win32_CDROMDrive | ForEach-Object {
        $opticalDrives += [PSCustomObject]@{
            Index = 0
            Id = $_.DeviceID
            Vendor = "Optical Drive"
            Product = $_.Name
            Revision = ""
            DriveLetter = $_.Drive
            MediaType = "Optical Media"
            IsBlank = $false
            TotalCapacity = 0
            FreeSpace = 0
        }
    }
}

$result = [PSCustomObject]@{
    StorageDrives = $storageDrives
    OpticalDrives = $opticalDrives
}

$result | ConvertTo-Json -Depth 5
