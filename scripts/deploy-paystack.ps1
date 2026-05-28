# Deploy paystack Edge Function to Supabase project xbhhpjtwawfawifhpxbe
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Generating PAYMENT_SECRETS_ENCRYPTION_KEY (save this value):" -ForegroundColor Cyan
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Write-Host ""

Write-Host "Deploying paystack function..." -ForegroundColor Cyan
supabase functions deploy paystack --project-ref xbhhpjtwawfawifhpxbe

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "CLI deploy failed. Deploy manually:" -ForegroundColor Yellow
  Write-Host "  https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/functions"
  Write-Host "Then set secret PAYMENT_SECRETS_ENCRYPTION_KEY in Dashboard -> Edge Functions -> Secrets"
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Set the encryption key (paste the value from above):" -ForegroundColor Cyan
Write-Host "  supabase secrets set PAYMENT_SECRETS_ENCRYPTION_KEY=YOUR_KEY --project-ref xbhhpjtwawfawifhpxbe"
