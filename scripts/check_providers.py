import os
import subprocess
import json

def check_openai():
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return "NOT_INSTALLED"
    # Basic curl test
    try:
        res = subprocess.run([
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "-H", f"Authorization: Bearer {key}",
            "https://api.openai.com/v1/models"
        ], capture_output=True, text=True)
        if res.stdout == "200":
            return "READY"
        elif res.stdout == "401":
            return "MISCONFIGURED"
        else:
            return f"ERROR_{res.stdout}"
    except Exception as e:
        return f"EXCEPTION_{str(e)}"

def check_claude():
    try:
        res = subprocess.run(["claude", "config", "get"], capture_output=True, text=True)
        if "You've hit your limit" in res.stdout or "You've hit your limit" in res.stderr:
            return "QUOTA_EXHAUSTED" # We'll treat this as READY but currently limited
        if res.returncode == 0:
            return "READY"
        return "MISCONFIGURED"
    except FileNotFoundError:
        return "NOT_INSTALLED"

def check_antigravity():
    # Since I'm running as Antigravity via OpenClaw, I'll check if the OpenClaw profile is set.
    # In this environment, 'openclaw' CLI is the entry point.
    try:
        res = subprocess.run(["openclaw", "auth", "status"], capture_output=True, text=True)
        if "google-antigravity" in res.stdout and "active" in res.stdout:
            return "READY"
        return "MISCONFIGURED"
    except FileNotFoundError:
        return "NOT_INSTALLED"

if __name__ == "__main__":
    # Load .env manually for OpenAI
    with open("/Users/ben/Desktop/Cairn/.env", "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k] = v

    results = {
        "openai": check_openai(),
        "claude": check_claude(),
        "antigravity": check_antigravity()
    }
    print(json.dumps(results, indent=2))
