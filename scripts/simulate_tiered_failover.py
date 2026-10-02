from pathlib import Path
CAIRN_ROOT = Path(__file__).resolve().parents[1]
import os
import sys
sys.path.append(str(CAIRN_ROOT / "scripts"))
from provider_router import ProviderRouter

def run_tier_simulation():
    print("Starting Tiered Failover Simulation...")
    
    # 1. Reset state
    if os.path.exists(str(CAIRN_ROOT / "config" / "provider_state.json")):
        os.remove(str(CAIRN_ROOT / "config" / "provider_state.json"))
    
    router = ProviderRouter()
    active = router.get_active_provider()
    print(f"Initial Active (Tier 1): {active}")
    
    # 2. Force antigravity_flash cooldown
    print(f"Mocking failure for {active}...")
    router.report_failure(active, "QUOTA_EXHAUSTED")
    
    # 3. Verify switch to another Tier 1
    new_active = router.get_active_provider()
    print(f"New Active (Should be Tier 1): {new_active}")
    
    # 4. Exhaust all Tier 1
    print("Exhausting all Tier 1 providers...")
    router.report_failure(new_active, "QUOTA_EXHAUSTED")
    
    # 5. Verify fallback to Tier 2
    fallback_active = router.get_active_provider()
    print(f"New Active (Should be Tier 2): {fallback_active}")

if __name__ == "__main__":
    run_tier_simulation()
