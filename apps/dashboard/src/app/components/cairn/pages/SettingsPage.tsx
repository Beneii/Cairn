import { Moon, Sun, Clock, Calendar, DollarSign, Zap, Brain, MessageSquare, Sliders, Box, Monitor } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";
import { IntegrationsSettings } from "./IntegrationsPage";
import { SystemSettings } from "./SystemPage";
import type { ProactiveConfig } from "../types";

interface ScheduleConfig {
    morningBriefingEnabled: boolean;
    morningBriefingTime: string;
    weeklyReviewEnabled: boolean;
    weeklyReviewDay: string;
    weeklyReviewTime: string;
}

interface SettingsPageProps {
    nav: ReactNode;
    darkMode: boolean;
    setDarkMode: (v: boolean) => void;
    // General Config
    config: {
        heartbeat_interval_ms: number;
        monthly_spend_limit_usd: number;
        max_decisions_per_day: number;
        max_interactions_per_day: number;
        has_openai_key: boolean;
        proactive?: ProactiveConfig;
        mobile_app_enabled: boolean;
        default_client: "telegram" | "mobile";
        mobile_pairing_secret?: string;
    };
    setHeartbeat: (v: number) => void;
    setSpendLimit: (v: number) => void;
    setDecisionLimit: (v: number) => void;
    setInteractionLimit: (v: number) => void;
    schedules?: ScheduleConfig;
    setSchedules?: (s: ScheduleConfig) => void;
    setProactive?: (config: Partial<ProactiveConfig>) => void;
    // Integrations Props
    hasOpenAI: boolean;
    setOpenAIKey: (key: string) => void;
    hasTelegram: boolean;
    setTelegramToken: (token: string) => void;
    telegramAdminChatId: string;
    setTelegramAdminChatId: (chatId: string) => void;
    hasGoogle?: boolean;
    gatewayUrl?: string;
    setMobileConfig?: (enabled: boolean, defaultClient: "telegram" | "mobile") => void;
    // System Props
    connected: boolean;
    diagnostics: {
        wsUrl: string;
        apiBase: string;
        mode: string;
        lastPong: string | null;
        lastError: string | null;
        reconnectCount: number;
    };
    nodes: Record<string, any>;
}

export function SettingsPage(props: SettingsPageProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'system'>('general');
    const { darkMode, setDarkMode, config, setHeartbeat, setSpendLimit, setDecisionLimit, setInteractionLimit, schedules, setSchedules, setProactive } = props;

    const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';
    const subtleBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(26,29,33,0.05)';
    const toggleActiveBg = darkMode ? 'rgba(255,255,255,0.15)' : '#ffffff';
    const inputBorder = darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(26,29,33,0.2)';
    const checkBg = darkMode ? '#E5E5E5' : '#1A1D21';
    const checkFg = darkMode ? '#1c1c1c' : '#F3F2EE';

    // Default schedules if not provided
    const sched = schedules ?? {
        morningBriefingEnabled: true,
        morningBriefingTime: "08:00",
        weeklyReviewEnabled: true,
        weeklyReviewDay: "sunday",
        weeklyReviewTime: "18:00",
    };

    const updateSchedule = (updates: Partial<ScheduleConfig>) => {
        if (setSchedules) {
            setSchedules({ ...sched, ...updates });
        }
    };

    const tabs = [
        { id: 'general', label: 'General', icon: <Sliders size={16} /> },
        { id: 'integrations', label: 'Integrations', icon: <Box size={16} /> },
        { id: 'system', label: 'System', icon: <Monitor size={16} /> },
    ] as const;

    return (
        <PageLayout nav={props.nav} darkMode={darkMode}>
            <PageContent title="Settings" darkMode={darkMode}>
                <div className="flex flex-col gap-6">
                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 p-1 rounded-lg w-max" style={{ backgroundColor: subtleBg }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                                style={activeTab === tab.id ? { backgroundColor: toggleActiveBg } : {}}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[400px]">
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Appearance */}
                                <section>
                                    <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${border}` }}>
                                        <Sun size={14} />
                                        Appearance
                                    </h3>
                                    <div className="flex items-center justify-between py-2">
                                        <div>
                                            <div className="text-sm font-medium">Theme</div>
                                            <div className="text-xs opacity-50">Light or dark mode</div>
                                        </div>
                                        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: subtleBg }}>
                                            <button
                                                onClick={() => setDarkMode(false)}
                                                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                                                style={!darkMode ? { backgroundColor: toggleActiveBg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { opacity: 0.5 }}
                                            >
                                                Light
                                            </button>
                                            <button
                                                onClick={() => setDarkMode(true)}
                                                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                                                style={darkMode ? { backgroundColor: toggleActiveBg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { opacity: 0.5 }}
                                            >
                                                Dark
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* Schedules */}
                                <section>
                                    <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${border}` }}>
                                        <Calendar size={14} />
                                        Schedules
                                    </h3>

                                    {/* Morning Briefing */}
                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">Morning Briefing</div>
                                            <div className="text-xs opacity-50">Daily summary via Telegram</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="time"
                                                value={sched.morningBriefingTime}
                                                onChange={(e) => updateSchedule({ morningBriefingTime: e.target.value })}
                                                className="bg-transparent rounded-md px-2 py-1 text-sm"
                                                style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            />
                                            <button
                                                onClick={() => updateSchedule({ morningBriefingEnabled: !sched.morningBriefingEnabled })}
                                                className="w-8 h-5 rounded-full transition-all relative"
                                                style={{ backgroundColor: sched.morningBriefingEnabled ? checkBg : subtleBg }}
                                            >
                                                <div
                                                    className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                                                    style={{
                                                        backgroundColor: sched.morningBriefingEnabled ? checkFg : 'currentColor',
                                                        opacity: sched.morningBriefingEnabled ? 1 : 0.3,
                                                        left: sched.morningBriefingEnabled ? '14px' : '2px'
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Weekly Review */}
                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">Weekly Review</div>
                                            <div className="text-xs opacity-50">Summary of the week</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={sched.weeklyReviewDay}
                                                onChange={(e) => updateSchedule({ weeklyReviewDay: e.target.value })}
                                                className="bg-transparent rounded-md px-2 py-1 text-sm"
                                                style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            >
                                                <option value="sunday">Sunday</option>
                                                <option value="saturday">Saturday</option>
                                                <option value="friday">Friday</option>
                                            </select>
                                            <input
                                                type="time"
                                                value={sched.weeklyReviewTime}
                                                onChange={(e) => updateSchedule({ weeklyReviewTime: e.target.value })}
                                                className="bg-transparent rounded-md px-2 py-1 text-sm"
                                                style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            />
                                            <button
                                                onClick={() => updateSchedule({ weeklyReviewEnabled: !sched.weeklyReviewEnabled })}
                                                className="w-8 h-5 rounded-full transition-all relative"
                                                style={{ backgroundColor: sched.weeklyReviewEnabled ? checkBg : subtleBg }}
                                            >
                                                <div
                                                    className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                                                    style={{
                                                        backgroundColor: sched.weeklyReviewEnabled ? checkFg : 'currentColor',
                                                        opacity: sched.weeklyReviewEnabled ? 1 : 0.3,
                                                        left: sched.weeklyReviewEnabled ? '14px' : '2px'
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Heartbeat */}
                                    <div className="flex items-center justify-between py-3">
                                        <div>
                                            <div className="text-sm font-medium flex items-center gap-2">
                                                <Zap size={14} className="opacity-50" />
                                                Heartbeat Interval
                                            </div>
                                            <div className="text-xs opacity-50">Background processing frequency</div>
                                        </div>
                                        <select
                                            value={config.heartbeat_interval_ms}
                                            onChange={(e) => setHeartbeat(Number(e.target.value))}
                                            className="bg-transparent rounded-md px-3 py-1.5 text-sm"
                                            style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                        >
                                            <option value={1000}>1s (High)</option>
                                            <option value={60000}>1 min</option>
                                            <option value={300000}>5 min</option>
                                            <option value={1800000}>30 min</option>
                                        </select>
                                    </div>
                                </section>

                                {/* Limits */}
                                <section>
                                    <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${border}` }}>
                                        <DollarSign size={14} />
                                        Limits
                                    </h3>
                                    <div className="flex items-center justify-between py-3">
                                        <div>
                                            <div className="text-sm font-medium">Monthly Spend Limit</div>
                                            <div className="text-xs opacity-50">Hard cap on LLM API usage</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-50">$</span>
                                            <input
                                                type="number"
                                                value={config.monthly_spend_limit_usd}
                                                onChange={(e) => setSpendLimit(Number(e.target.value))}
                                                className="w-20 bg-transparent rounded-md px-2 py-1 text-right text-sm"
                                                style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            />
                                            <span className="text-xs opacity-50">USD</span>
                                        </div>
                                    </div>
                                </section>

                                {/* Cognitive Load */}
                                <section>
                                    <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${border}` }}>
                                        <Brain size={14} />
                                        Cognitive Load Budget
                                    </h3>

                                    {/* Decision Limit */}
                                    <div className="flex items-center justify-between py-3">
                                        <div>
                                            <div className="text-sm font-medium">Daily Decision Limit</div>
                                            <div className="text-xs opacity-50">Max interruptions for choices per day</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={config.max_decisions_per_day}
                                                onChange={(e) => setDecisionLimit(Number(e.target.value))}
                                                className="w-16 bg-transparent rounded-md px-2 py-1 text-right text-sm"
                                                style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Interaction Limit */}
                                    <div className="flex items-center justify-between py-3">
                                        <div>
                                            <div className="text-sm font-medium">Daily Interaction Limit</div>
                                            <div className="text-xs opacity-50">Max total messages from Cairn per day</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={config.max_interactions_per_day}
                                                onChange={(e) => setInteractionLimit(Number(e.target.value))}
                                                className="w-16 bg-transparent rounded-md px-2 py-1 text-right text-sm"
                                                style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* Proactive Intelligence */}
                                {config.proactive && setProactive && (
                                    <section>
                                        <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${border}` }}>
                                            <MessageSquare size={14} />
                                            Proactive Intelligence
                                        </h3>

                                        <div className="flex items-center justify-between py-3">
                                            <div>
                                                <div className="text-sm font-medium">Proactive Nudges</div>
                                                <div className="text-xs opacity-50">Allow Cairn to initiate conversations</div>
                                            </div>
                                            <button
                                                onClick={() => setProactive({ enabled: !config.proactive?.enabled })}
                                                className="w-8 h-5 rounded-full transition-all relative"
                                                style={{ backgroundColor: config.proactive.enabled ? checkBg : subtleBg }}
                                            >
                                                <div
                                                    className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                                                    style={{
                                                        backgroundColor: config.proactive.enabled ? checkFg : 'currentColor',
                                                        opacity: config.proactive.enabled ? 1 : 0.3,
                                                        left: config.proactive.enabled ? '14px' : '2px'
                                                    }}
                                                />
                                            </button>
                                        </div>

                                        {config.proactive.enabled && (
                                            <div className="space-y-3 pl-4 border-l-2" style={{ borderColor: border }}>
                                                <div className="flex items-center justify-between py-2">
                                                    <div className="text-sm">Max Daily Nudges</div>
                                                    <input
                                                        type="number"
                                                        value={config.proactive.maxDailyNudges}
                                                        onChange={(e) => setProactive({ maxDailyNudges: Number(e.target.value) })}
                                                        className="w-16 bg-transparent rounded-md px-2 py-1 text-right text-sm"
                                                        style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between py-2">
                                                    <div className="text-sm">Quiet Hours</div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <input
                                                            type="number"
                                                            min={0} max={23}
                                                            value={config.proactive.quietHoursStart}
                                                            onChange={(e) => setProactive({ quietHoursStart: Number(e.target.value) })}
                                                            className="w-12 bg-transparent rounded-md px-1 py-1 text-center"
                                                            style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                                        />
                                                        <span className="opacity-50">to</span>
                                                        <input
                                                            type="number"
                                                            min={0} max={23}
                                                            value={config.proactive.quietHoursEnd}
                                                            onChange={(e) => setProactive({ quietHoursEnd: Number(e.target.value) })}
                                                            className="w-12 bg-transparent rounded-md px-1 py-1 text-center"
                                                            style={{ border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    <div className="text-xs uppercase opacity-50 mb-2">Nudge Types</div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Object.entries(config.proactive.nudgeTypes).map(([key, enabled]) => (
                                                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer opacity-80 hover:opacity-100">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={enabled}
                                                                    onChange={(e) => setProactive({
                                                                        nudgeTypes: {
                                                                            ...config.proactive!.nudgeTypes,
                                                                            [key]: e.target.checked
                                                                        }
                                                                    })}
                                                                    className="rounded bg-transparent"
                                                                    style={{ borderColor: inputBorder }}
                                                                />
                                                                <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        )}

                        {activeTab === 'integrations' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <IntegrationsSettings
                                    darkMode={darkMode}
                                    hasOpenAI={props.hasOpenAI}
                                    setOpenAIKey={props.setOpenAIKey}
                                    hasTelegram={props.hasTelegram}
                                    setTelegramToken={props.setTelegramToken}
                                    telegramAdminChatId={props.telegramAdminChatId}
                                    setTelegramAdminChatId={props.setTelegramAdminChatId}
                                    hasGoogle={props.hasGoogle}
                                    gatewayUrl={props.gatewayUrl}
                                    mobileEnabled={config.mobile_app_enabled}
                                    defaultClient={config.default_client}
                                    mobilePairingSecret={config.mobile_pairing_secret}
                                    setMobileConfig={async (enabled, client) => {
                                        // We need to implement this in App.tsx and pass it down, 
                                        // or just use the websocket client directly if we had access.
                                        // actually SettingsPageProps needs to include setMobileConfig
                                        if (props.setMobileConfig) {
                                            props.setMobileConfig(enabled, client);
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {activeTab === 'system' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <SystemSettings
                                    darkMode={darkMode}
                                    connected={props.connected}
                                    diagnostics={props.diagnostics}
                                    nodes={props.nodes}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </PageContent>
        </PageLayout>
    );
}
