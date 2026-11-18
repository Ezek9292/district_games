<#
.SYNOPSIS
  Sets up District Games on the edonkor.dev server and deploys it, from your own PC.

.DESCRIPTION
  Run from the repo folder in the VS Code terminal:

    powershell -ExecutionPolicy Bypass -File server\setup-server.ps1

  What it does:
    1. Checks backend\.env.production (the server's settings). The first time, it creates it from your
       local backend\.env and stops so you can check it.
    2. Logs in to the server with your admin key (~/.ssh/edonkor_admin).
    3. Uploads server/setup-church-games.sh and the env file, and runs the setup on the server
       (Node, PM2, build, database migrations, Nginx for both domains).
    4. Checks that both sites respond.

  Run it again any time; it is safe. To change a setting on the server later, edit
  backend\.env.production and run it again.

  Options:
    -ServerIp 1.2.3.4   another server (default 37.27.34.194)
#>
param(
    [string]$ServerIp = "37.27.34.194",
    [string]$KeyPath = "$HOME\.ssh\edonkor_admin"
)

# "Continue", not "Stop": in Windows PowerShell 5.1, "Stop" turns ssh's harmless stderr
# warnings into fatal errors. Every native call checks $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Target = "root@$ServerIp"
$SiteDomain = "districtgames.edonkor.dev"
$ApiDomain = "districtgames-api.edonkor.dev"
$AppDir = "/home/deploy/church-games"
$EnvProd = Join-Path $RepoRoot "backend\.env.production"
$EnvLocal = Join-Path $RepoRoot "backend\.env"
$EnvExample = Join-Path $RepoRoot "backend\.env.example"
$SetupScript = Join-Path $RepoRoot "server\setup-church-games.sh"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

# Run ssh/scp and stop the script if they fail.
function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments)
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { Fail "$Exe exited with code $LASTEXITCODE" }
}

# Read KEY=value lines of an env file into a hashtable (quotes removed).
function Read-EnvFile($path) {
    $values = @{}
    foreach ($line in Get-Content $path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $values[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
        }
    }
    return $values
}

$SshOpts = @("-i", $KeyPath, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new")

# --- Checks ------------------------------------------------------------------
Step "Checking tools and files"
foreach ($tool in "ssh", "scp", "curl.exe") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool not found." }
}
if (-not (Test-Path $SetupScript)) { Fail "Missing $SetupScript" }
if (-not (Test-Path $KeyPath)) { Fail "Admin key $KeyPath not found (the portfolio setup creates it)." }
Write-Host "OK"

# --- 1. Production settings --------------------------------------------------------
Step "Production settings (backend\.env.production)"
if (-not (Test-Path $EnvProd)) {
    # Start from the local settings (same Supabase, SMTP, Cloudinary), with a new JWT secret.
    $source = if (Test-Path $EnvLocal) { $EnvLocal } else { $EnvExample }
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $jwt = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    $lines = Get-Content $source | Where-Object { $_ -notmatch '^\s*(JWT_SECRET|NODE_ENV|FRONTEND_ORIGIN|HOST|PORT)\s*=' }
    $lines += "JWT_SECRET=`"$jwt`""
    # UTF-8 without BOM, so the server reads the first line correctly.
    [System.IO.File]::WriteAllLines($EnvProd, [string[]]$lines, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "Created backend\.env.production from $(Split-Path -Leaf $source), with a new JWT_SECRET." -ForegroundColor Yellow
    Write-Host "It stays on your PC (git ignores it). Check every value is right for the LIVE site:"
    Write-Host "  DATABASE_URL, DIRECT_URL, ORGANIZER_EMAILS, SMTP_*, MAIL_FROM, CLOUDINARY_URL"
    Write-Host "(NODE_ENV, FRONTEND_ORIGIN, HOST and PORT are set by the server setup.)"
    Write-Host "Then run this script again." -ForegroundColor Yellow
    & code $EnvProd 2>$null
    exit 0
}
$envValues = Read-EnvFile $EnvProd
$missing = @()
foreach ($key in "DATABASE_URL", "DIRECT_URL", "JWT_SECRET", "ORGANIZER_EMAILS", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "CLOUDINARY_URL") {
    $v = $envValues[$key]
    if (-not $v -or $v -match 'PROJECT_REF|PASSWORD@|you@example\.com|no-reply@example\.com|localhost|127\.0\.0\.1') { $missing += $key }
}
if ($missing.Count -gt 0) {
    Fail "backend\.env.production still needs real values for: $($missing -join ', ')`n  Edit it, then run this script again."
}
Write-Host "OK"

# --- 2. Log in -------------------------------------------------------------------------
Step "Logging in to $Target with $KeyPath"
# A key with a passphrase can't be used non-interactively. Load it into ssh-agent so the
# passphrase is typed once; without the agent, ssh asks for it on every connection (about 4 times).
& ssh-keygen -y -P "" -f $KeyPath *> $null
if ($LASTEXITCODE -ne 0) {
    $agent = Get-Service ssh-agent -ErrorAction SilentlyContinue
    if ($agent -and $agent.Status -eq "Running") {
        & ssh-add -l *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Your key has a passphrase; adding it to ssh-agent (type the passphrase once)."
            & ssh-add $KeyPath
        }
    } else {
        Write-Host ("Your key has a passphrase and ssh-agent isn't running, so you'll be asked for it several`n" +
                    "times. To type it only once, run in an ADMIN PowerShell:`n" +
                    "  Set-Service ssh-agent -StartupType Automatic; Start-Service ssh-agent") -ForegroundColor Yellow
    }
}
& ssh @SshOpts -o PreferredAuthentications=publickey -o ConnectTimeout=10 $Target "echo Logged in to `$(hostname)"
if ($LASTEXITCODE -ne 0) {
    Fail ("Could not log in to $Target with $KeyPath.`n" +
          "  - Wrong passphrase? Try again.`n" +
          "  - 'REMOTE HOST IDENTIFICATION HAS CHANGED': run  ssh-keygen -R $ServerIp  and try again.`n" +
          "  - Key not on the server: run the portfolio's server\setup-server.ps1 first.")
}

# --- 3. Server setup ---------------------------------------------------------------------
Step "Uploading the setup script and settings"
Invoke-Native scp ($SshOpts + @($SetupScript, $EnvProd, "${Target}:/root/"))
Invoke-Native ssh ($SshOpts + @($Target, "chmod 600 /root/.env.production"))

Step "Running the setup on the server (the first time takes 5-10 minutes)"
# sed strips Windows line endings in case git converted the file.
Invoke-Native ssh ($SshOpts + @($Target, ("sed -i 's/\r$//' /root/setup-church-games.sh && " +
    "bash /root/setup-church-games.sh /root/.env.production")))

# --- 4. Check -----------------------------------------------------------------------------
Step "Checking both sites on the server"
$ok = $true
foreach ($check in @(@($SiteDomain, "/"), @($ApiDomain, "/health"))) {
    $domain, $path = $check
    $code = & curl.exe -sk -o NUL -w "%{http_code}" --max-time 20 --resolve "${domain}:443:$ServerIp" "https://$domain$path"
    if ($code -eq "200") {
        Write-Host "https://$domain$path answers 200" -ForegroundColor Green
    } else {
        Write-Host "https://$domain$path answered '$code' (expected 200)" -ForegroundColor Yellow
        $ok = $false
    }
}
if (-not $ok) {
    Write-Host "Logs: ssh -i $KeyPath $Target `"sudo -u deploy pm2 logs --lines 50 --nostream`"" -ForegroundColor Yellow
}

Write-Host @"

Done. Remaining one-time steps:
  1. GitHub > district_games > Settings > Secrets and variables > Actions > New repository secret:
       SSH_HOST         = $ServerIp
       SSH_USER         = deploy
       APP_DIR          = $AppDir
       SSH_PRIVATE_KEY  = the same key as the portfolio: the whole of $HOME\.ssh\github_deploy
     and under Environments, make sure 'production' has no rules that block the deploy.
  2. Push to main (or re-run the latest CI run): the 'Deploy to server' job now deploys every push.

Log in to the server any time with:
  ssh -i $KeyPath $Target
"@ -ForegroundColor Green
