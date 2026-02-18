# Continuous Evolution Supervisor (Hardened Runner)

Script: `scripts/continuous-evolution-runner.ps1`

## Start
Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\continuous-evolution-runner.ps1
```

Recommended overnight launch (background process):

```powershell
Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File .\scripts\continuous-evolution-runner.ps1' -WorkingDirectory (Get-Location)
```

## Stop
1. Read lock file PID:

```powershell
Get-Content .\documents\runtime\continuous-evolution-lock.json | ConvertFrom-Json | Select-Object -ExpandProperty pid
```

2. Stop that process:

```powershell
Stop-Process -Id <PID>
```

## Status
Machine-readable status snapshot:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\continuous-evolution-runner.ps1 -Status
```

Primary files:
- Heartbeat: `documents/runtime/continuous-evolution-heartbeat.json` (updated every <=60s while active, including backoff)
- Metrics: `documents/runtime/continuous-evolution-metrics.json`
- Lock info: `documents/runtime/continuous-evolution-lock.json`
- Logs: `documents/runtime/continuous-evolution-runner.log`

## Runtime behavior
- Single-instance guarded via global named mutex (`Global\CairnContinuousEvolutionRunner`).
- Failover state machine per iteration:
  1. Run Sonnet
  2. If Sonnet fails, run Codex
  3. If Codex fails, sleep 60 minutes
  4. Retry with Sonnet again
- Metrics persist across restarts.
- Crash/finally paths update heartbeat + metrics to terminal state for watchdog visibility.
