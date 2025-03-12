# Supabase Edge Functions Deployment Script
# Usage: .\scripts\deploy-edge-functions.ps1

$ProjectId = "ztsbrysfvmmlxtzoyvle"

Write-Host "Deploying Edge Functions..." -ForegroundColor Green

# List of Edge Functions to deploy
$functions = @(
    "activate-subscription",
    "bulk-import",
    "cancel-google-subscription",
    "cancel-subscription",
    "check-duplicate-contact",
    "create-subscription",
    "delete-user",
    "get-user-stats",
    "google-play-webhooks",
    "paypal-webhooks",
    "push-notifications",
    "sync-to-brevo",
    "users",
    "verify-google-purchase"
)

# Deploy each function
foreach ($func in $functions) {
    Write-Host "Deploying $func..." -ForegroundColor Yellow
    try {
        $output = supabase functions deploy $func --project-ref $ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully deployed $func" -ForegroundColor Green
        } else {
            Write-Host "Failed to deploy $func" -ForegroundColor Red
            Write-Host $output -ForegroundColor Red
        }
    } catch {
        Write-Host "Error deploying $func" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host "`nEdge Functions deployment complete!" -ForegroundColor Green
Write-Host "Verify deployment in your Supabase Dashboard at https://supabase.com/dashboard/project/$ProjectId/functions" -ForegroundColor Cyan