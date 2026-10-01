param()
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot 'apps\desktop\src-tauri\target\release\oracle-desktop.exe'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Build the Windows desktop first.' }
if (@(Get-Process oracle-desktop -ErrorAction SilentlyContinue).Count -gt 0) {
    throw 'Close Oracle before publishing its updated shortcuts.'
}
$digest = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
$programRoot = Join-Path $env:LOCALAPPDATA 'Programs\Oracle'
$releaseRoot = Join-Path $programRoot ('releases\' + $digest)
$target = Join-Path $releaseRoot 'oracle-desktop.exe'
# No existing release is overwritten. Refuse redirected installation directories.
foreach ($candidate in @($programRoot, (Join-Path $programRoot 'releases'), $releaseRoot)) {
    if (Test-Path -LiteralPath $candidate) {
        $entry = Get-Item -LiteralPath $candidate
        if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Unexpected Oracle installation directory.'
        }
    }
}
if (Test-Path -LiteralPath $target) {
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $digest) {
        throw 'Installed executable differs from its release identity.'
    }
} else {
    $null = New-Item -ItemType Directory -Path $releaseRoot -Force
    Copy-Item -LiteralPath $source -Destination $target
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $digest) {
        throw 'Installed executable verification failed.'
    }
}
$shell = New-Object -ComObject WScript.Shell
$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Oracle.lnk'
$desktopLink = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Oracle.lnk'
$pinned = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Oracle.lnk'
$links = @($startMenu, $desktopLink)
if (Test-Path -LiteralPath $pinned) { $links += $pinned }
foreach ($link in $links) {
    $shortcut = $shell.CreateShortcut($link)
    if ((Test-Path -LiteralPath $link) -and $shortcut.TargetPath -and
        [IO.Path]::GetFileName($shortcut.TargetPath) -ne 'oracle-desktop.exe') {
        throw 'An Oracle-named shortcut points to another application; it was not replaced.'
    }
    $shortcut.TargetPath = $target
    $shortcut.WorkingDirectory = $releaseRoot
    $shortcut.IconLocation = $target + ',0'
    $shortcut.Description = 'Oracle private workspace'
    $shortcut.Save()
}
@{ ok = $true; executable = $target; sha256 = $digest } | ConvertTo-Json -Compress
