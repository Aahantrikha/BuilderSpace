# PowerShell script to allow port 3001 through Windows Firewall
# Run this as Administrator

Write-Host "Adding Windows Firewall rule for Kaivan backend (port 3001)..." -ForegroundColor Cyan

# Remove existing rule if it exists
Remove-NetFirewallRule -DisplayName "Kaivan Backend" -ErrorAction SilentlyContinue

# Add new inbound rule for port 3001
New-NetFirewallRule -DisplayName "Kaivan Backend" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3001 `
    -Action Allow `
    -Profile Any `
    -Description "Allow Kaivan backend server on port 3001"

Write-Host "✅ Firewall rule added successfully!" -ForegroundColor Green
Write-Host "Port 3001 is now accessible from other devices on your network." -ForegroundColor Green
