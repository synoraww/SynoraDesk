<#
.SYNOPSIS
    Builds the SynoraDesk Windows Installer (.msi) package using WiX Toolset v7.
.DESCRIPTION
    Compiles Package.wxs with WixUI_InstallDir, rich text license, desktop and start menu shortcuts,
    and automatic application launch support.
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SynoraDesk MSI Installer Build Pipeline " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Find WiX Toolset executable
$wixCandidates = @(
    "C:\Program Files\WiX Toolset v7.0\bin\wix.exe",
    "C:\Program Files (x86)\WiX Toolset v7.0\bin\wix.exe",
    (Get-Command wix -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
)

$wixExe = $null
foreach ($path in $wixCandidates) {
    if ($path -and (Test-Path $path)) {
        $wixExe = $path
        break
    }
}

if (-not $wixExe) {
    Write-Error "WiX Toolset (wix.exe) was not found. Please install WiX Toolset v7."
    exit 1
}

Write-Host "[+] WiX Toolset found: $wixExe" -ForegroundColor Green

# Verify binary existence
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Resolve-Path "$scriptDir\..\.."
$sourceExe = "$projectRoot\build\bin\pterodesk.exe"

if (-not (Test-Path $sourceExe)) {
    Write-Warning "[!] Source executable not found at $sourceExe. Building with Wails..."
    Push-Location $projectRoot
    wails build -clean -s -platform windows/amd64
    Pop-Location
}

if (-not (Test-Path $sourceExe)) {
    Write-Error "Failed to locate build binary: $sourceExe"
    exit 1
}

$outputMsi = "$projectRoot\build\bin\SynoraDesk-Installer-v1.06A-x64.msi"
$wxsFile = "$scriptDir\Package.wxs"

Write-Host "[*] Compiling MSI package with WiX v7..." -ForegroundColor Yellow
Push-Location $scriptDir
try {
    & $wixExe build --acceptEula wix7 `
        -ext WixToolset.UI.wixext `
        -ext WixToolset.Util.wixext `
        -arch x64 `
        -out $outputMsi `
        $wxsFile

    if ($LASTEXITCODE -eq 0 -and (Test-Path $outputMsi)) {
        $fileSizeMB = [math]::Round((Get-Item $outputMsi).Length / 1MB, 2)
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host " [SUCCESS] MSI Installer built successfully!" -ForegroundColor Green
        Write-Host " Output file: $outputMsi" -ForegroundColor White
        Write-Host " Size: $fileSizeMB MB" -ForegroundColor White
        Write-Host "==========================================" -ForegroundColor Green
    } else {
        Write-Error "WiX build failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
