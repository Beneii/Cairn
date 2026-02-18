param(
  [string]$RepoPath = "C:\Users\Admin\Desktop\Cairn\Cairn",
  [string]$Branch = "cairn/auto/health-sweep-2026-02-18",
  [int]$RetryDelayMinutes = 60,
  [int]$HeartbeatIntervalSeconds = 60,
  [switch]$Status,
  [switch]$Once,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$scriptVersion = "2.0.0"
$runnerName = "cairn-continuous-evolution-runner"
$mutexName = "Global\CairnContinuousEvolutionRunner"

$runtimeDir = Join-Path $RepoPath "documents\runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$logFile = Join-Path $runtimeDir "continuous-evolution-runner.log"
$metricsFile = Join-Path $runtimeDir "continuous-evolution-metrics.json"
$heartbeatFile = Join-Path $runtimeDir "continuous-evolution-heartbeat.json"
$lockInfoFile = Join-Path $runtimeDir "continuous-evolution-lock.json"

$global:CurrentEngine = "idle"
$global:CurrentState = "initializing"
$global:CurrentIteration = 0
$global:StopRequested = $false

function Write-Log([string]$msg, [string]$level = "INFO") {
  $line = "[$(Get-Date -Format o)] [$level] $msg"
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

function Read-JsonFile([string]$path) {
  if (!(Test-Path $path)) { return $null }
  try {
    return (Get-Content -Path $path -Raw | ConvertFrom-Json)
  } catch {
    Write-Log "Failed to parse JSON at ${path}: $($_.Exception.Message)" "WARN"
    return $null
  }
}

function Write-JsonFile([string]$path, [object]$data) {
  $json = $data | ConvertTo-Json -Depth 8
  Set-Content -Path $path -Value $json
}

function New-DefaultMetrics() {
  return [ordered]@{
    runner = $runnerName
    version = $scriptVersion
    startedAt = (Get-Date).ToString("o")
    updatedAt = (Get-Date).ToString("o")
    iterationsAttempted = 0
    iterationsSucceeded = 0
    iterationsFailed = 0
    consecutiveFailures = 0
    lastSuccessTime = $null
    lastFailureTime = $null
    lastAttemptTime = $null
    currentEngine = "idle"
    currentState = "initializing"
    lastExitCode = $null
    lastError = $null
    pid = $PID
  }
}

function Initialize-Metrics() {
  $existing = Read-JsonFile -path $metricsFile
  if ($null -eq $existing) {
    $metrics = New-DefaultMetrics
    Write-Log "No prior metrics found. Initializing new metrics file."
  } else {
    $metrics = [ordered]@{}
    $existing.PSObject.Properties | ForEach-Object { $metrics[$_.Name] = $_.Value }
    Write-Log "Loaded existing metrics: attempted=$($metrics.iterationsAttempted), succeeded=$($metrics.iterationsSucceeded), failed=$($metrics.iterationsFailed), consecutiveFailures=$($metrics.consecutiveFailures)."
  }

  $metrics.version = $scriptVersion
  $metrics.updatedAt = (Get-Date).ToString("o")
  $metrics.currentEngine = "idle"
  $metrics.currentState = "initializing"
  $metrics.pid = $PID
  Write-JsonFile -path $metricsFile -data $metrics
  return $metrics
}

function Persist-Metrics([hashtable]$metrics) {
  $metrics.updatedAt = (Get-Date).ToString("o")
  Write-JsonFile -path $metricsFile -data $metrics
}

function Update-Heartbeat([hashtable]$metrics, [string]$detail = "") {
  $payload = [ordered]@{
    runner = $runnerName
    version = $scriptVersion
    pid = $PID
    timestamp = (Get-Date).ToString("o")
    state = $global:CurrentState
    engine = $global:CurrentEngine
    iteration = $global:CurrentIteration
    detail = $detail
    metrics = [ordered]@{
      iterationsAttempted = $metrics.iterationsAttempted
      iterationsSucceeded = $metrics.iterationsSucceeded
      iterationsFailed = $metrics.iterationsFailed
      consecutiveFailures = $metrics.consecutiveFailures
      lastSuccessTime = $metrics.lastSuccessTime
      lastFailureTime = $metrics.lastFailureTime
      currentEngine = $metrics.currentEngine
    }
  }
  Write-JsonFile -path $heartbeatFile -data $payload
}

function Acquire-RunnerMutex() {
  $script:RunnerMutex = New-Object System.Threading.Mutex($false, $mutexName)
  if (-not $script:RunnerMutex.WaitOne(0, $false)) {
    Write-Log "Another runner instance already holds mutex '$mutexName'. Exiting." "ERROR"
    exit 2
  }

  $lockInfo = [ordered]@{
    runner = $runnerName
    pid = $PID
    startedAt = (Get-Date).ToString("o")
    repoPath = $RepoPath
    branch = $Branch
    mutex = $mutexName
  }
  Write-JsonFile -path $lockInfoFile -data $lockInfo
  Write-Log "Acquired single-instance lock (mutex='$mutexName', pid=$PID)."
}

function Release-RunnerMutex() {
  try {
    if (Test-Path $lockInfoFile) {
      Remove-Item -Path $lockInfoFile -Force
    }
  } catch {
    Write-Log "Failed to remove lock info file: $($_.Exception.Message)" "WARN"
  }

  if ($script:RunnerMutex) {
    try {
      $script:RunnerMutex.ReleaseMutex() | Out-Null
      $script:RunnerMutex.Dispose()
      Write-Log "Released single-instance lock."
    } catch {
      Write-Log "Mutex release warning: $($_.Exception.Message)" "WARN"
    }
  }
}

function Invoke-Engine([string]$engine, [string]$prompt, [hashtable]$metrics) {
  $global:CurrentEngine = $engine
  $global:CurrentState = "running"
  $metrics.currentEngine = $engine
  $metrics.currentState = "running"
  Persist-Metrics -metrics $metrics
  Update-Heartbeat -metrics $metrics -detail "Running $engine iteration"

  $stdout = Join-Path $runtimeDir ("{0}-{1}-stdout.log" -f $engine, $PID)
  $stderr = Join-Path $runtimeDir ("{0}-{1}-stderr.log" -f $engine, $PID)
  Remove-Item -Path $stdout,$stderr -ErrorAction SilentlyContinue

  $exe = if ($engine -eq "sonnet") { "claude" } else { "codex" }
  $args = if ($engine -eq "sonnet") {
    @("--model", "sonnet", "--print", $prompt)
  } else {
    @("exec", "--json", $prompt)
  }

  Write-Log "Starting iteration via $engine..."
  Push-Location $RepoPath
  try {
    $proc = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    while (-not $proc.HasExited) {
      Start-Sleep -Seconds $HeartbeatIntervalSeconds
      Update-Heartbeat -metrics $metrics -detail "$engine running (pid=$($proc.Id))"
    }
    $code = $proc.ExitCode
  } catch {
    $code = 1
    Write-Log "$engine execution threw: $($_.Exception.Message)" "ERROR"
  } finally {
    Pop-Location
  }

  if (Test-Path $stdout) {
    Add-Content -Path $logFile -Value ("--- BEGIN {0} STDOUT ---" -f $engine)
    Get-Content -Path $stdout | Add-Content -Path $logFile
    Add-Content -Path $logFile -Value ("--- END {0} STDOUT ---" -f $engine)
  }
  if (Test-Path $stderr) {
    Add-Content -Path $logFile -Value ("--- BEGIN {0} STDERR ---" -f $engine)
    Get-Content -Path $stderr | Add-Content -Path $logFile
    Add-Content -Path $logFile -Value ("--- END {0} STDERR ---" -f $engine)
  }

  Write-Log "$engine exit code: $code"
  return $code
}

function Sleep-WithHeartbeat([int]$minutes, [hashtable]$metrics, [string]$reason) {
  $totalSeconds = [Math]::Max(1, $minutes * 60)
  $slept = 0
  $global:CurrentState = "backoff"
  $metrics.currentState = "backoff"
  Persist-Metrics -metrics $metrics

  while ($slept -lt $totalSeconds) {
    $remaining = $totalSeconds - $slept
    Update-Heartbeat -metrics $metrics -detail "$reason | retry in ${remaining}s"
    $step = [Math]::Min($HeartbeatIntervalSeconds, $remaining)
    Start-Sleep -Seconds $step
    $slept += $step
  }
}

function Show-Status() {
  $metrics = Read-JsonFile -path $metricsFile
  $heartbeat = Read-JsonFile -path $heartbeatFile
  $lockInfo = Read-JsonFile -path $lockInfoFile

  $status = [ordered]@{
    lock = $lockInfo
    heartbeat = $heartbeat
    metrics = $metrics
  }

  $status | ConvertTo-Json -Depth 8
}

$iterationPrompt = @'
You are running one Cairn brain-only evolution iteration in this repository.
Hard scope: orchestration/planning/reasoning, memory/log awareness, sub-agent systems, and continuous runtime reliability. Avoid UI/product work unless needed for compile integrity.

Rules:
- Improve existing systems first; do not add unnecessary new abstractions.
- Make one high-impact, measurable mutation.
- Run validation: pnpm lint && pnpm test && pnpm build.
- Update documents/evolution-log.md with summary, files, risks, metrics before/after, rollback instructions.
- Commit and push to current branch.
- If mutation fails validation, rollback and still leave repo runnable.
- Output concise final summary with commit hash and key metric delta.
'@

if ($Status) {
  Show-Status
  exit 0
}

$metrics = Initialize-Metrics

try {
  Acquire-RunnerMutex
  $global:CurrentState = "bootstrapping"
  $metrics.currentState = "bootstrapping"
  Persist-Metrics -metrics $metrics
  Update-Heartbeat -metrics $metrics -detail "Runner booting"

  Write-Log "Continuous evolution runner booting (version=$scriptVersion, dryRun=$DryRun, once=$Once)..."
  Push-Location $RepoPath
  try {
    git checkout $Branch | Out-Null
    git pull --rebase | Out-Null
  } catch {
    Write-Log "Branch prep warning: $($_.Exception.Message)" "WARN"
  } finally {
    Pop-Location
  }

  while (-not $global:StopRequested) {
    $global:CurrentIteration += 1
    $global:CurrentState = "attempt"
    $metrics.currentState = "attempt"
    $metrics.lastAttemptTime = (Get-Date).ToString("o")
    $metrics.iterationsAttempted = [int]$metrics.iterationsAttempted + 1
    Persist-Metrics -metrics $metrics
    Update-Heartbeat -metrics $metrics -detail "Starting iteration #$($global:CurrentIteration)"

    if ($DryRun) {
      Write-Log "Dry-run enabled: skipping engine execution and marking synthetic success."
      $sonnetCode = 0
    } else {
      $sonnetCode = Invoke-Engine -engine "sonnet" -prompt $iterationPrompt -metrics $metrics
    }

    if ($sonnetCode -eq 0) {
      $metrics.iterationsSucceeded = [int]$metrics.iterationsSucceeded + 1
      $metrics.consecutiveFailures = 0
      $metrics.lastSuccessTime = (Get-Date).ToString("o")
      $metrics.lastExitCode = 0
      $metrics.lastError = $null
      $metrics.currentEngine = "sonnet"
      $metrics.currentState = "success"
      Persist-Metrics -metrics $metrics
      $global:CurrentState = "success"
      Update-Heartbeat -metrics $metrics -detail "Iteration succeeded via sonnet"
      Write-Log "Iteration #$($global:CurrentIteration) succeeded via sonnet."
      if ($Once) { break }
      continue
    }

    Write-Log "Sonnet failed. Falling back to codex..." "WARN"
    if ($DryRun) {
      $codexCode = 0
    } else {
      $codexCode = Invoke-Engine -engine "codex" -prompt $iterationPrompt -metrics $metrics
    }

    if ($codexCode -eq 0) {
      $metrics.iterationsSucceeded = [int]$metrics.iterationsSucceeded + 1
      $metrics.consecutiveFailures = 0
      $metrics.lastSuccessTime = (Get-Date).ToString("o")
      $metrics.lastExitCode = 0
      $metrics.lastError = $null
      $metrics.currentEngine = "codex"
      $metrics.currentState = "success"
      Persist-Metrics -metrics $metrics
      $global:CurrentState = "success"
      Update-Heartbeat -metrics $metrics -detail "Iteration succeeded via codex"
      Write-Log "Iteration #$($global:CurrentIteration) succeeded via codex."
      if ($Once) { break }
      continue
    }

    $metrics.iterationsFailed = [int]$metrics.iterationsFailed + 1
    $metrics.consecutiveFailures = [int]$metrics.consecutiveFailures + 1
    $metrics.lastFailureTime = (Get-Date).ToString("o")
    $metrics.lastExitCode = $codexCode
    $metrics.lastError = "Both sonnet and codex failed for iteration #$($global:CurrentIteration)."
    $metrics.currentEngine = "codex"
    $metrics.currentState = "backoff"
    Persist-Metrics -metrics $metrics
    $global:CurrentState = "backoff"

    Write-Log "Both engines failed. Entering backoff for $RetryDelayMinutes minutes before retry." "ERROR"
    if ($Once) { break }
    Sleep-WithHeartbeat -minutes $RetryDelayMinutes -metrics $metrics -reason "Engine failover exhausted"
  }
}
catch {
  $global:CurrentState = "crashed"
  $metrics.currentState = "crashed"
  $metrics.lastFailureTime = (Get-Date).ToString("o")
  $metrics.lastError = $_.Exception.Message
  Persist-Metrics -metrics $metrics
  Update-Heartbeat -metrics $metrics -detail "Runner crashed: $($_.Exception.Message)"
  Write-Log "Runner crashed: $($_.Exception.Message)" "ERROR"
  throw
}
finally {
  $global:CurrentEngine = "idle"
  $global:CurrentState = "stopped"
  $metrics.currentEngine = "idle"
  $metrics.currentState = "stopped"
  Persist-Metrics -metrics $metrics
  Update-Heartbeat -metrics $metrics -detail "Runner stopped"
  Release-RunnerMutex
}
