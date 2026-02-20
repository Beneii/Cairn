import json
import os
from provider_router import ProviderRouter

def run_simulation():
    print("Starting End-to-End Simulation...")
    router = ProviderRouter()
    
    # 1. Initial State
    active = router.get_active_provider()
    print(f"Initial Active Provider: {active}")
    
    # 2. Mock quota failure
    print(f"Mocking quota failure for {active}...")
    router.report_failure(active, "QUOTA_EXHAUSTED")
    
    # 3. Verify switch
    new_active = router.get_active_provider()
    print(f"New Active Provider: {new_active}")
    
    if active == new_active:
        print("FAILED: Provider did not switch.")
    else:
        print("SUCCESS: Provider switched correctly.")
    
    # 4. Verify persistence (re-instantiate router)
    print("Verifying persistence across 'restart'...")
    router2 = ProviderRouter()
    persisted_active = router2.get_active_provider()
    print(f"Persisted Active Provider: {persisted_active}")
    
    if persisted_active == new_active:
        print("SUCCESS: State persisted correctly.")
    else:
        print("FAILED: State did not persist.")

if __name__ == "__main__":
    # Reset state for clean simulation
    if os.path.exists("/Users/ben/Desktop/Cairn/config/provider_state.json"):
        os.remove("/Users/ben/Desktop/Cairn/config/provider_state.json")
    
    run_simulation()
