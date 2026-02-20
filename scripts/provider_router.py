import json
import os
import time
from datetime import datetime, timedelta

STATE_FILE = "/Users/ben/Desktop/Cairn/config/provider_state.json"
LOG_FILE = "/Users/ben/Desktop/Cairn/logs/provider.log"
COOLDOWN_HOURS = 24

class ProviderRouter:
    def __init__(self):
        self.state = self._load_state()

    def _load_state(self):
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r") as f:
                state = json.load(f)
                # Ensure structure is upgraded if necessary
                if "providers" in state:
                    for pid, data in state["providers"].items():
                        if "tokens_used" not in data: data["tokens_used"] = 0
                        if "requests_made" not in data: data["requests_made"] = 0
                        if "daily_budget_tokens" not in data: data["daily_budget_tokens"] = 1000000 # Default
                return state
        
        # Default starting state with tiered structure
        return {
            "active_provider": "antigravity_flash",
            "models": {
                "planning": "o3-pro",
                "refactoring": "gpt-5-codex",
                "auditing": "o1-pro",
                "execution": "gpt-4o"
            },
            "providers": {
                "antigravity_flash": {"status": "READY", "last_failure": None, "cooldown_until": None, "tier": 1, "tokens_used": 0, "requests_made": 0, "daily_budget_tokens": 1000000},
                "antigravity_pro": {"status": "READY", "last_failure": None, "cooldown_until": None, "tier": 1, "tokens_used": 0, "requests_made": 0, "daily_budget_tokens": 1000000},
                "openai": {"status": "READY", "last_failure": None, "cooldown_until": None, "tier": 2, "tokens_used": 0, "requests_made": 0, "daily_budget_tokens": 1000000},
                "claude": {"status": "READY", "last_failure": None, "cooldown_until": None, "tier": 2, "tokens_used": 0, "requests_made": 0, "daily_budget_tokens": 1000000}
            }
        }

    def _save_state(self):
        with open(STATE_FILE, "w") as f:
            json.dump(self.state, f, indent=2)

    def _log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")

    def _log_usage(self, provider_id, tokens, success=True):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        usage_log = "/Users/ben/Desktop/Cairn/logs/provider_usage.log"
        
        display_tokens = tokens if tokens is not None else "UNKNOWN"
        
        with open(usage_log, "a") as f:
            f.write(f"[{timestamp}] {provider_id} | Tokens: {display_tokens} | Success: {success}\n")
        
        if tokens is not None:
            self.state["providers"][provider_id]["tokens_used"] += tokens
            self.state["providers"][provider_id]["requests_made"] += 1
            
            # Check budget
            if self.state["providers"][provider_id]["tokens_used"] >= self.state["providers"][provider_id]["daily_budget_tokens"]:
                self._log(f"BUDGET EXCEEDED for {provider_id}")
                self.report_failure(provider_id, "BUDGET_EXCEEDED")
        
        self._save_state()

    def get_active_provider(self):
        active = self.state["active_provider"]
        provider_data = self.state["providers"].get(active)
        
        if not provider_data:
            return self._switch_provider()

        cooldown = provider_data.get("cooldown_until")
        if cooldown and datetime.fromisoformat(cooldown) > datetime.now():
            self._log(f"Active provider {active} is in cooldown. Searching for fallback.")
            return self._switch_provider()
        
        return active

    def report_failure(self, provider_id, error_type="QUOTA_EXHAUSTED"):
        self._log(f"Failure reported for {provider_id}: {error_type}")
        self.state["providers"][provider_id]["last_failure"] = datetime.now().isoformat()
        
        if error_type in ["QUOTA_EXHAUSTED", "BUDGET_EXCEEDED"]:
            cooldown_time = datetime.now() + timedelta(hours=COOLDOWN_HOURS)
            self.state["providers"][provider_id]["cooldown_until"] = cooldown_time.isoformat()
            self.state["providers"][provider_id]["status"] = "COOLDOWN"
            self._log(f"{provider_id} entered cooldown until {cooldown_time}")
            
            if provider_id == self.state["active_provider"]:
                self._switch_provider()
        
        self._save_state()

    def _switch_provider(self):
        # Tier-aware switching
        all_providers = self.state["providers"]
        
        # Sort by tier, then original order
        sorted_pids = sorted(all_providers.keys(), key=lambda x: (all_providers[x].get("tier", 2), x))
        
        for pid in sorted_pids:
            data = all_providers[pid]
            cooldown = data.get("cooldown_until")
            if not cooldown or datetime.fromisoformat(cooldown) <= datetime.now():
                old_provider = self.state["active_provider"]
                self.state["active_provider"] = pid
                self._log(f"SWITCH: {old_provider} -> {pid} (Tier {data.get('tier')})")
                self._save_state()
                return pid
        
        self._log("CRITICAL: No ready providers available in any tier!")
        return None

    def get_status_report(self):
        return self.state

    def get_model_for_task(self, task):
        return self.state.get("models", {}).get(task, "gpt-4o")
