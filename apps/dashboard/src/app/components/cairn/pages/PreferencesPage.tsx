import { ArrowLeft, Moon, Sun, Key } from "lucide-react";
import { useState } from "react";

export function PreferencesPage({
    onBack,
    darkMode,
    setDarkMode,
    config,
    setHeartbeat,
    setSpendLimit
}: {
    onBack: () => void,
    darkMode: boolean,
    setDarkMode: (v: boolean) => void,
    config: { heartbeat_interval_ms: number, monthly_spend_limit_usd: number, has_openai_key: boolean },
    setHeartbeat: (v: number) => void,
    setSpendLimit: (v: number) => void
}) {

    return (
        <div className="flex flex-col h-full p-8 bg-[#F3F2EE] text-[#1A1D21] max-w-3xl mx-auto w-full">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 hover:bg-[#1A1D21]/5 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold tracking-tight">Preferences</h2>
            </div>

            <div className="space-y-8 overflow-y-auto">
                <section>
                    <h3 className="text-sm uppercase tracking-widest opacity-50 mb-4 border-b border-[#1A1D21]/10 pb-2">Appearance</h3>
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <div className="font-medium">Interface Theme</div>
                            <div className="text-sm opacity-50">Toggle between light and inverted dark mode</div>
                        </div>
                        <div className="flex gap-2 bg-[#1A1D21]/5 p-1 rounded-lg">
                            <button onClick={() => setDarkMode(false)} className={`p-2 rounded-md transition-all ${!darkMode ? 'bg-white shadow-sm' : 'opacity-50'}`}><Sun size={16} /></button>
                            <button onClick={() => setDarkMode(true)} className={`p-2 rounded-md transition-all ${darkMode ? 'bg-white shadow-sm' : 'opacity-50'}`}><Moon size={16} /></button>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm uppercase tracking-widest opacity-50 mb-4 border-b border-[#1A1D21]/10 pb-2">System</h3>
                    <div className="flex items-center justify-between py-4">
                        <div>
                            <div className="font-medium">Heartbeat Interval</div>
                            <div className="text-sm opacity-50">How often the Nucleus processes background tasks</div>
                        </div>
                        <select
                            value={config.heartbeat_interval_ms}
                            onChange={(e) => setHeartbeat(Number(e.target.value))}
                            className="bg-transparent border border-[#1A1D21]/20 rounded-md px-3 py-1.5 text-sm"
                        >
                            <option value={1000}>1s (High Performance)</option>
                            <option value={60000}>60s (Balanced)</option>
                            <option value={300000}>5m (Low Power)</option>
                        </select>
                    </div>
                </section>

                <section>
                    <h3 className="text-sm uppercase tracking-widest opacity-50 mb-4 border-b border-[#1A1D21]/10 pb-2">Billing & Limits</h3>
                    <div className="flex items-center justify-between py-4">
                        <div>
                            <div className="font-medium">Monthly Spend Limit</div>
                            <div className="text-sm opacity-50">Hard stop for LLM API usage</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="opacity-50">$</span>
                            <input
                                type="number"
                                value={config.monthly_spend_limit_usd}
                                onChange={(e) => setSpendLimit(Number(e.target.value))}
                                className="w-20 bg-transparent border border-[#1A1D21]/20 rounded-md px-2 py-1 text-right"
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
