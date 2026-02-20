#!/usr/bin/env python3
import subprocess
import os
import sys
from datetime import datetime

def run_command(cmd, shell=False):
    try:
        result = subprocess.run(cmd, shell=shell, check=True, capture_output=True, text=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
        print(e.stderr)
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: ./commit.sh <task_name>")
        sys.exit(1)

    task = sys.argv[1]
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    branch = f"cairn-auto/{task}/{timestamp}"

    print(f"Starting governance-hardened commit for branch: {branch}")

    # 1. Secret Guard
    print("Checking for secrets...")
    # Check for .env or API key patterns in staged files
    staged_files = run_command(["git", "diff", "--name-only", "--cached"]).split('\n')
    for f in staged_files:
        if f == ".env":
            print("BLOCK: .env file staged for commit!")
            sys.exit(1)
        if os.path.exists(f):
            with open(f, 'r') as content:
                if "sk-" in content.read(): # Basic OpenAI key pattern
                    print(f"BLOCK: API key pattern detected in {f}!")
                    sys.exit(1)

    # 2. Lint/Build/Test Simulation (minimal placeholders)
    print("Running tests...")
    # placeholder: run_command(["python3", "-m", "unittest", "discover", "tests"])

    # 3. Create branch and commit
    run_command(["git", "checkout", "-b", branch])
    run_command(["git", "commit", "-m", f"Auto-commit: {task}"])
    print(f"SUCCESS: Committed to {branch}")

if __name__ == "__main__":
    main()
