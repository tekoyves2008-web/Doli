# sauvegarde.ps1
# Sauvegarde automatique du projet Doli dans Git.
# Appelé par la tâche planifiée Windows "Doli-Sauvegarde-Git" (toutes les heures),
# ou à la main : powershell -NoProfile -ExecutionPolicy Bypass -File "sauvegarde.ps1"

$ErrorActionPreference = 'Stop'
# $PSScriptRoot = le dossier contenant ce script = la racine du projet.
Set-Location $PSScriptRoot

$gitCmd = "$env:ProgramFiles\Git\cmd"
if (Test-Path $gitCmd) { $env:Path += ";$gitCmd" }

# Ne commit que s'il y a réellement des modifications (sinon, rien à faire).
$statut = git status --porcelain
if (-not $statut) { exit 0 }

git add -A
$horodatage = Get-Date -Format 'dd/MM/yyyy HH:mm'
$noms = (git diff --cached --name-only | Measure-Object).Count
git commit -m "Sauvegarde automatique du $horodatage ($noms fichier(s) modifié(s))" --quiet
Write-Host "Sauvegarde effectuée : $noms fichier(s) commité(s) à $horodatage"