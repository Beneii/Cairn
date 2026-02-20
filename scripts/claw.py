#!/usr/bin/env python3
import sys
import json
from provider_router import ProviderRouter

def doctor():
    router = ProviderRouter()
    report = router.get_status_report()
    
    print("Cairn Provider Status Report")
    print("============================")
    print(f"Active Provider: {report['active_provider']}")
    print("")
    print("Model Assignments")
    print("-----------------")
    for task, model in report.get('models', {}).items():
        print(f"{task.capitalize():<15}: {model}")
    print("")
    print(f"{'Provider':<25} | {'Tier':<4} | {'Status':<12} | {'Tokens Used':<12} | {'Budget':<10}")
    print("-" * 90)
    
    # Sort by tier then name
    sorted_pids = sorted(report['providers'].keys(), key=lambda x: (report['providers'][x].get('tier', 2), x))
    
    for pid in sorted_pids:
        data = report['providers'][pid]
        tier = data.get('tier', 2)
        status = data.get('status', 'READY')
        used = data.get('tokens_used', 0)
        budget = data.get('daily_budget_tokens', 'N/A')
        
        print(f"{pid:<25} | {tier:<4} | {status:<12} | {used:<12} | {budget:<10}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "doctor":
        doctor()
    else:
        print("Usage: claw doctor")
