param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$StateRoot = (Join-Path $env:LOCALAPPDATA 'coastal-research-automation'),
    [string]$PythonPath = (Get-Command python -ErrorAction Stop).Source,
    [string]$TaskName = 'Sirui Coastal Research Discovery'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$StateRoot = [IO.Path]::GetFullPath($StateRoot)
$PythonPath = (Resolve-Path -LiteralPath $PythonPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'bin/coastal_research.py'))) {
    throw 'The selected checkout does not contain the coastal research runner.'
}
$worktreeLines = & git -C $RepoRoot worktree list --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect repository worktrees.' }
foreach ($line in $worktreeLines) {
    if ($line.StartsWith('worktree ')) {
        $checkoutPath = [IO.Path]::GetFullPath($line.Substring(9)).TrimEnd('\', '/')
        if ($StateRoot.Equals($checkoutPath, [StringComparison]::OrdinalIgnoreCase) -or
            $StateRoot.StartsWith($checkoutPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Raw research task state must stay outside every repository worktree.'
        }
    }
}
[IO.Directory]::CreateDirectory($StateRoot) | Out-Null
$wrapperPath = Join-Path $StateRoot 'discover.ps1'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $wrapperPath + '"'
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing -and ($existing.Actions.Count -ne 1 -or $existing.Actions[0].Arguments -ne $arguments)) {
    throw 'An existing task with this name has another action; it was left unchanged.'
}
$template = @'
$ErrorActionPreference = 'Stop'
$repo = '__REPO__'
$python = '__PYTHON__'
$logs = Join-Path $PSScriptRoot 'logs'
[IO.Directory]::CreateDirectory($logs) | Out-Null
$log = Join-Path $logs ((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') + '.log')
Push-Location -LiteralPath $repo
try {
    # Discovery fetches exact queued public URLs and starts zero model jobs.
    & $python -B -X utf8 bin/coastal_research.py discover --repo $repo 2>&1 |
        Out-File -LiteralPath $log -Encoding utf8
    $result = $LASTEXITCODE
    if ($null -eq $result) { $result = 1 }
}
catch {
    $_ | Out-File -LiteralPath $log -Encoding utf8 -Append
    $result = 1
}
finally { Pop-Location }
exit $result
'@
$wrapper = $template.Replace('__REPO__', $RepoRoot.Replace("'", "''")).Replace('__PYTHON__', $PythonPath.Replace("'", "''"))
[IO.File]::WriteAllText($wrapperPath, $wrapper, [Text.UTF8Encoding]::new($false))
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At '05:15'
# A local wall-time boundary follows Pacific daylight-saving changes.
$trigger.StartBoundary = (Get-Date -Hour 5 -Minute 15 -Second 0).ToString('s')
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -Hidden -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Refresh known public coastal rendering research leads; zero automatic model jobs.' -Force | Out-Null
$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName
[ordered]@{
    task = $TaskName
    state = [string]$task.State
    nextRun = $info.NextRunTime.ToString('o')
    hidden = $task.Settings.Hidden
    runLevel = [string]$task.Principal.RunLevel
    modelJobs = 0
    wrapperSha256 = (Get-FileHash -LiteralPath $wrapperPath -Algorithm SHA256).Hash.ToLowerInvariant()
} | ConvertTo-Json
