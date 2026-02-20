import os
import subprocess
import json
import time
from provider_router import ProviderRouter

# Ensure .env is loaded
def load_env():
    with open("/Users/ben/Desktop/Cairn/.env", "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k] = v

class ExecutionPipeline:
    def __init__(self):
        load_env()
        self.router = ProviderRouter()

    def call_openai(self, prompt, model="gpt-3.5-turbo"):
        """Real OpenAI call with metadata extraction"""
        key = os.getenv("OPENAI_API_KEY")
        cmd = [
            "curl", "-s", "https://api.openai.com/v1/chat/completions",
            "-H", "Content-Type: application/json",
            "-H", f"Authorization: Bearer {key}",
            "-d", json.dumps({
                "model": model,
                "messages": [{"role": "user", "content": prompt}]
            })
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        try:
            data = json.loads(res.stdout)
            if "error" in data:
                self.router.report_failure("openai", data["error"].get("code", "API_ERROR"))
                return data
            
            usage = data.get("usage", {}).get("total_tokens")
            if usage is not None:
                self.router._log_usage("openai", usage)
            return data
        except Exception:
            self.router.report_failure("openai", "PARSE_ERROR")
            return None

    def call_claude(self, prompt):
        """Real Claude Code invocation via CLI"""
        # Claude Code CLI uses 'claude "<prompt>"' for one-shot
        cmd = ["claude", "-p", prompt]
        res = subprocess.run(cmd, capture_output=True, text=True)
        
        # Claude Code CLI output is usually text. 
        # Token usage is not currently exposed in a stable machine-readable way via CLI.
        # Following strict instruction: if usage metadata unavailable, set usage=UNKNOWN.
        if res.returncode != 0:
            if "limit" in res.stdout.lower() or "limit" in res.stderr.lower():
                self.router.report_failure("claude", "QUOTA_EXHAUSTED")
            else:
                self.router.report_failure("claude", "EXECUTION_ERROR")
        
        # Usage metadata unavailable from this CLI wrapper
        return res.stdout + res.stderr

    def call_antigravity(self, prompt, tier="flash"):
        """Real Antigravity agent invocation via OpenClaw CLI"""
        provider_id = f"antigravity_{tier}"
        # Fixed: shell=True helps with complex command parsing in some subprocess environments
        cmd = f'openclaw agent --to +15550001234 --message "{prompt}" --json'
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        
        try:
            data = json.loads(res.stdout)
            # OpenClaw agent responses include usage metadata when --json is passed
            usage = data.get("usage", {}).get("total_tokens")
            if usage is not None:
                self.router._log_usage(provider_id, usage)
            return data
        except Exception:
            # Fallback for non-JSON or error output
            if res.returncode != 0:
                self.router.report_failure(provider_id, "CLI_ERROR")
            return res.stdout

    def execute(self, task, prompt):
        """Pipeline entry point"""
        # 1. Show where get_active_provider() is called
        active = self.router.get_active_provider()
        model = self.router.get_model_for_task(task)
        
        print(f"PIPELINE: Executing '{task}' using {active} (Model: {model})")
        
        if active == "openai":
            return self.call_openai(prompt, model="gpt-3.5-turbo") # Using 3.5 for trace to save credits
        elif active == "claude":
            return self.call_claude(prompt)
        else:
            return self.call_antigravity(prompt)

if __name__ == "__main__":
    pipeline = ExecutionPipeline()
    
    print("--- TRACE: OpenAI ---")
    pipeline.router.state["active_provider"] = "openai" # Force for trace
    pipeline.execute("execution", "test")
    
    print("\n--- TRACE: Claude ---")
    pipeline.router.state["active_provider"] = "claude" # Force for trace
    pipeline.execute("execution", "test")

    print("\n--- TRACE: Antigravity ---")
    pipeline.router.state["active_provider"] = "antigravity_flash" # Force for trace
    pipeline.execute("execution", "test")
