# Serve Veil locally. A PWA needs a real origin — opening index.html from the
# filesystem gives no service worker and no install prompt.
#
#   .\serve.ps1            -> http://localhost:8123
#   .\serve.ps1 -Port 9000
param([int]$Port = 8123)

$root = $PSScriptRoot
Write-Host ""
Write-Host "  Veil running at http://localhost:$Port" -ForegroundColor Magenta
Write-Host "  Install it from Chrome's address bar, or test on your phone with:" -ForegroundColor DarkGray
Write-Host "    tailscale serve $Port" -ForegroundColor DarkGray
Write-Host "  Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

python -m http.server $Port --directory $root
