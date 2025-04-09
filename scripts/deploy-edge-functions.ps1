# Supabase Edge Functions Deployment Script
# Usage: .\scripts\deploy-edge-functions.ps1

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and !$line.StartsWith("#")) {
            $key, $value = $line.Split('=', 2)
            if ($key -and $value) {
                [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
            }
        }
    }
}

$ProjectId = $env:SUPABASE_PROJECT_ID
if (-not $ProjectId) {
    Write-Host "Error: SUPABASE_PROJECT_ID environment variable is not set in .env file" -ForegroundColor Red
    Write-Host "Please set SUPABASE_PROJECT_ID=your-project-id in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying Edge Functions to project $ProjectId..." -ForegroundColor Green

# List of Edge Functions to deploy
$functions = @(
    "activate-subscription",
    "bulk-import",
    "bulk-import-vcf",
    "cancel-google-subscription",
    "cancel-subscription",
    "check-duplicate-contact",
    "create-subscription",
    "delete-user",
    "export-data",
    "get-user-stats",
    "google-play-webhooks",
    "llm-chat-handler",
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