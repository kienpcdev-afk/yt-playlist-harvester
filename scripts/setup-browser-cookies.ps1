# Thiết lập một lần: cho phép yt-dlp đọc cookies Chrome/Edge khi trình duyệt đang mở.
# Chạy: npm run setup:browser-cookies

$ErrorActionPreference = 'Continue'
$Flag = '--disable-features=LockProfileCookieDatabase'

function Add-FlagToShortcut {
    param([string]$ShortcutPath)

    if (-not (Test-Path -LiteralPath $ShortcutPath)) { return 'none' }

    try {
        $shell = New-Object -ComObject WScript.Shell
        $link = $shell.CreateShortcut($ShortcutPath)
        $target = $link.TargetPath
        if (-not $target) { return 'none' }

        $name = [System.IO.Path]::GetFileNameWithoutExtension($target).ToLowerInvariant()
        if ($name -notin @('chrome', 'msedge')) { return 'none' }

        if ($link.Arguments -like "*$Flag*") {
            Write-Host "  Da co flag: $ShortcutPath"
            return 'ok'
        }

        if ([string]::IsNullOrWhiteSpace($link.Arguments)) {
            $link.Arguments = $Flag
        } else {
            $link.Arguments = "$($link.Arguments.Trim()) $Flag"
        }

        $link.Save()
        Write-Host "  Da them flag: $ShortcutPath"
        return 'ok'
    } catch {
        Write-Host "  Bo qua (khong co quyen ghi): $ShortcutPath" -ForegroundColor Yellow
        return 'skip'
    }
}

Write-Host "Tim shortcut Chrome/Edge tren Desktop va Start Menu...`n"

$paths = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
)

$updated = 0
$skipped = 0

foreach ($dir in $paths) {
    if (-not (Test-Path -LiteralPath $dir)) { continue }

    $links = @()
    try {
        $links = @(Get-ChildItem -LiteralPath $dir -Filter '*.lnk' -Recurse -ErrorAction Stop)
    } catch {
        Write-Host "Bo qua thu muc (khong doc duoc): $dir" -ForegroundColor Yellow
        continue
    }

    foreach ($item in $links) {
        switch (Add-FlagToShortcut -ShortcutPath $item.FullName) {
            'ok' { $updated++ }
            'skip' { $skipped++ }
        }
    }
}

if ($updated -eq 0) {
    Write-Host "`nKhong sua duoc shortcut Chrome/Edge nao."
    Write-Host "Tao shortcut thu cong voi duong dan, vi du:"
    Write-Host "  `"C:\Program Files\Google\Chrome\Application\chrome.exe`" $Flag"
    Write-Host "  `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" $Flag"
    exit 1
}

Write-Host "`nXong ($updated shortcut)."
if ($skipped -gt 0) {
    Write-Host "Bo qua $skipped shortcut (khong co quyen, binh thuong neu la shortcut he thong)." -ForegroundColor Yellow
}
Write-Host "Mo Chrome/Edge bang shortcut tren Desktop cua ban (khong mo tu thanh tim kiem)."
Write-Host "Dang nhap YouTube, roi chay: npm run setup:cookies"
