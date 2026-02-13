import { Sun, Calendar, DollarSign, Brain, MessageSquare, Sliders, Box, Monitor } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";
import { IntegrationsSettings } from "./IntegrationsPage";
import { SystemSettings } from "./SystemPage";
import type { ProactiveConfig } from "../types";
import { useTheme } from "../../../theme";

interface SettingsPageProps {
    nav: ReactNode;
    darkMode: boolean;
    setDarkMode: (v: boolean) => void;
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
        local_mode_enabled: boolean;
    };
    setHeartbeat: (v: number) => void;
    setSpendLimit: (v: number) => void;
    setDecisionLimit: (v: number) => void;
    setInteractionLimit: (v: number) => void;
    schedules?: never;
    setSchedules?: never;
    setProactive?: (config: Partial<ProactiveConfig>) => void;
    hasOpenAI: boolean;
    setOpenAIKey: (key: string) => void;
    hasTelegram: boolean;
    setTelegramToken: (token: string) => void;
    telegramAdminChatId: string;
    setTelegramAdminChatId: (chatId: string) => void;
    hasGoogle?: boolean;
    gatewayUrl?: string;
    setMobileConfig?: (enabled: boolean, defaultClient: "telegram" | "mobile") => void;
    connected: boolean;
    diagnostics: {
        wsUrl: string;
        apiBase: string;
        mode: string;
        lastPong: string | null;
        lastError: string | null;
        reconnectCount: number;
    };
    setLocalMode: (enabled: boolean) => void;
    nodes: Record<string, any>;
    triggerUpdate?: () => void;
    updateProgress?: {
        stage: "idle" | "pulling" | "building" | "restarting" | "error";
        message: string;
    } | null;
}

/** Reusable toggle switch. */
function Toggle({ enabled, onChange, darkMode }: { enabled: boolean; onChange: () => void; darkMode: boolean }) {
    const theme = useTheme(darkMode);
    const trackBg = enabled ? theme.fg : theme.border;
    const thumbBg = enabled ? theme.bg : 'currentColor';

    return (
        <button
            onClick={onChange}
            className="w-8 h-5 rounded-full transition-all relative shrink-0"
            style={{ backgroundColor: trackBg }}
        >
            <div
                className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                style={{
                    backgroundColor: thumbBg,
                    opacity: enabled ? 1 : 0.3,
                    left: enabled ? '14px' : '2px'
                }}
            />
        </button>
    );
}

function formatHour(h: number): string {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
}

export function SettingsPage(props: SettingsPageProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'system'>('general');
    const { darkMode, setDarkMode, config, setHeartbeat, setSpendLimit, setDecisionLimit, setInteractionLimit, setProactive } = props;
    const theme = useTheme(darkMode);
    const proactive = config.proactive;

    const tabs = [
        { id: 'general', label: 'General', icon: <Sliders size={16} /> },
        { id: 'integrations', label: 'Integrations', icon: <Box size={16} /> },
        { id: 'system', label: 'System', icon: <Monitor size={16} /> },
    ] as const;

    const inputStyle = {
        border: `1px solid ${theme.borderSubtle}`,
        color: 'inherit',
        backgroundColor: 'transparent'
    };

    return (
        <PageLayout nav={props.nav} darkMode={darkMode}>
            <PageContent title="Settings" darkMode={darkMode}>
                <div className="flex flex-col gap-6">
                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 p-1 rounded-lg w-max" style={{ backgroundColor: theme.subtleBg }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                                style={activeTab === tab.id ? { backgroundColor: theme.activeBg } : {}}
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
                                <Section icon={<Sun size={14} />} label="Appearance" border={theme.border}>
                                    <Row label="Theme" description="Light or dark mode">
                                        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: theme.subtleBg }}>
                                            <button
                                                onClick={() => setDarkMode(false)}
                                                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                                                style={!darkMode ? { backgroundColor: theme.activeBg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { opacity: 0.5 }}
                                            >
                                                Light
                                            </button>
                                            <button
                                                onClick={() => setDarkMode(true)}
                                                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                                                style={darkMode ? { backgroundColor: theme.activeBg, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { opacity: 0.5 }}
                                            >
                                                Dark
                                            </button>
                                        </div>
                                    </Row>
                                </Section>

                                {/* Schedules & Automation */}
                                {proactive && setProactive && (
                                    <Section icon={<Calendar size={14} />} label="Schedules & Automation" border={theme.border}>
                                        {/* Morning Briefing */}
                                        <Row label="Morning Briefing" description="Daily summary with calendar, goals & recommendations">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <select
                                                        value={proactive.briefingWindowStart ?? 7}
                                                        onChange={(e) => setProactive({ briefingWindowStart: Number(e.target.value) })}
                                                        className="rounded-md px-2 py-1 text-sm"
                                                        style={inputStyle}
                                                    >
                                                        {Array.from({ length: 24 }, (_, i) => (
                                                            <option key={i} value={i}>{formatHour(i)}</option>
                                                        ))}
                                                    </select>
                                                    <span className="opacity-50">to</span>
                                                    <select
                                                        value={proactive.briefingWindowEnd ?? 9}
                                                        onChange={(e) => setProactive({ briefingWindowEnd: Number(e.target.value) })}
                                                        className="rounded-md px-2 py-1 text-sm"
                                                        style={inputStyle}
                                                    >
                                                        {Array.from({ length: 24 }, (_, i) => (
                                                            <option key={i} value={i}>{formatHour(i)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <Toggle enabled={proactive.briefingEnabled ?? true} onChange={() => setProactive({ briefingEnabled: !(proactive.briefingEnabled ?? true) })} darkMode={darkMode} />
                                            </div>
                                        </Row>

                                        {/* Check-ins */}
                                        <Row label="Check-ins" description="Periodic friendly messages based on your tasks">
                                            <Toggle enabled={proactive.checkInsEnabled ?? true} onChange={() => setProactive({ checkInsEnabled: !(proactive.checkInsEnabled ?? true) })} darkMode={darkMode} />
                                        </Row>

                                        {/* End-of-Day Librarian */}
                                        <Row label="End-of-Day Librarian" description="Auto-archives done tasks and generates daily summary">
                                            <div className="flex items-center gap-3">
                                                <select
                                                    value={proactive.librarianHour ?? 17}
                                                    onChange={(e) => setProactive({ librarianHour: Number(e.target.value) })}
                                                    className="rounded-md px-2 py-1 text-sm"
                                                    style={inputStyle}
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>{formatHour(i)}</option>
                                                    ))}
                                                </select>
                                                <Toggle enabled={proactive.librarianEnabled ?? true} onChange={() => setProactive({ librarianEnabled: !(proactive.librarianEnabled ?? true) })} darkMode={darkMode} />
                                            </div>
                                        </Row>

                                        {/* Heartbeat */}
                                        <Row label="Heartbeat Interval" description="Background processing frequency">
                                            <select
                                                value={config.heartbeat_interval_ms}
                                                onChange={(e) => setHeartbeat(Number(e.target.value))}
                                                className="rounded-md px-3 py-1.5 text-sm"
                                                style={inputStyle}
                                            >
                                                <option value={1000}>1s (High)</option>
                                                <option value={60000}>1 min</option>
                                                <option value={300000}>5 min</option>
                                                <option value={1800000}>30 min</option>
                                            </select>
                                        </Row>
                                    </Section>
                                )}

                                {/* Proactive Intelligence */}
                                {proactive && setProactive && (
                                    <Section icon={<MessageSquare size={14} />} label="Proactive Intelligence" border={theme.border}>
                                        <Row label="Proactive Nudges" description="Allow Cairn to initiate conversations about goals and tasks">
                                            <Toggle enabled={proactive.enabled} onChange={() => setProactive({ enabled: !proactive.enabled })} darkMode={darkMode} />
                                        </Row>

                                        {proactive.enabled && (
                                            <div className="space-y-1 pl-4 border-l-2" style={{ borderColor: theme.border }}>
                                                <Row label="Max Daily Nudges" description="">
                                                    <input
                                                        type="number"
                                                        value={proactive.maxDailyNudges}
                                                        onChange={(e) => setProactive({ maxDailyNudges: Number(e.target.value) })}
                                                        className="w-16 rounded-md px-2 py-1 text-right text-sm"
                                                        style={inputStyle}
                                                    />
                                                </Row>

                                                <Row label="Min Hours Between Nudges" description="">
                                                    <input
                                                        type="number"
                                                        value={proactive.minHoursBetweenNudges}
                                                        onChange={(e) => setProactive({ minHoursBetweenNudges: Number(e.target.value) })}
                                                        className="w-16 rounded-md px-2 py-1 text-right text-sm"
                                                        style={inputStyle}
                                                    />
                                                </Row>

                                                <Row label="Quiet Hours" description="">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <select
                                                            value={proactive.quietHoursStart}
                                                            onChange={(e) => setProactive({ quietHoursStart: Number(e.target.value) })}
                                                            className="rounded-md px-2 py-1"
                                                            style={inputStyle}
                                                        >
                                                            {Array.from({ length: 24 }, (_, i) => (
                                                                <option key={i} value={i}>{formatHour(i)}</option>
                                                            ))}
                                                        </select>
                                                        <span className="opacity-50">to</span>
                                                        <select
                                                            value={proactive.quietHoursEnd}
                                                            onChange={(e) => setProactive({ quietHoursEnd: Number(e.target.value) })}
                                                            className="rounded-md px-2 py-1"
                                                            style={inputStyle}
                                                        >
                                                            {Array.from({ length: 24 }, (_, i) => (
                                                                <option key={i} value={i}>{formatHour(i)}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </Row>

                                                <div className="py-2">
                                                    <div className="text-xs uppercase opacity-50 tracking-widest mb-2">Nudge Types</div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Object.entries(proactive.nudgeTypes).map(([key, enabled]) => (
                                                            <label
                                                                key={key}
                                                                className="flex items-center gap-2 text-sm cursor-pointer opacity-80 hover:opacity-100"
                                                                onClick={() => setProactive({
                                                                    nudgeTypes: { ...proactive.nudgeTypes, [key]: !enabled }
                                                                })}
                                                            >
                                                                <span
                                                                    className="w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0"
                                                                    style={{
                                                                        borderColor: theme.borderSubtle,
                                                                        backgroundColor: enabled ? theme.fg : 'transparent',
                                                                        color: enabled ? theme.bg : 'transparent',
                                                                    }}
                                                                >
                                                                    {enabled && '\u2713'}
                                                                </span>
                                                                <span className="capitalize">
                                                                    {key.replace(/_/g, ' ')}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Section>
                                )}

                                {/* Limits */}
                                <Section icon={<DollarSign size={14} />} label="Limits" border={theme.border}>
                                    <Row label="Monthly Spend Limit" description="Hard cap on LLM API usage">
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-50">$</span>
                                            <input
                                                type="number"
                                                value={config.monthly_spend_limit_usd}
                                                onChange={(e) => setSpendLimit(Number(e.target.value))}
                                                className="w-20 rounded-md px-2 py-1 text-right text-sm"
                                                style={inputStyle}
                                            />
                                            <span className="text-xs opacity-50">USD</span>
                                        </div>
                                    </Row>
                                </Section>

                                {/* Cognitive Load */}
                                <Section icon={<Brain size={14} />} label="Cognitive Load Budget" border={theme.border}>
                                    <Row label="Daily Decision Limit" description="Max interruptions for choices per day">
                                        <input
                                            type="number"
                                            value={config.max_decisions_per_day}
                                            onChange={(e) => setDecisionLimit(Number(e.target.value))}
                                            className="w-16 rounded-md px-2 py-1 text-right text-sm"
                                            style={inputStyle}
                                        />
                                    </Row>

                                    <Row label="Daily Interaction Limit" description="Max total messages from Cairn per day">
                                        <input
                                            type="number"
                                            value={config.max_interactions_per_day}
                                            onChange={(e) => setInteractionLimit(Number(e.target.value))}
                                            className="w-16 rounded-md px-2 py-1 text-right text-sm"
                                            style={inputStyle}
                                        />
                                    </Row>
                                </Section>
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
                                    localModeEnabled={props.config.local_mode_enabled}
                                    nodes={props.nodes}
                                    setLocalMode={props.setLocalMode}
                                    triggerUpdate={props.triggerUpdate}
                                    updateProgress={props.updateProgress}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </PageContent>
        </PageLayout>
    );
}

/** Section header with icon. */
function Section({ icon, label, border, children }: { icon: ReactNode; label: string; border: string; children: ReactNode }) {
    return (
        <section>
            <h3
                className="text-xs uppercase tracking-widest opacity-50 mb-4 pb-2 flex items-center gap-2"
                style={{ borderBottom: `1px solid ${border}` }}
            >
                {icon}
                {label}
            </h3>
            <div className="space-y-1">
                {children}
            </div>
        </section>
    );
}

/** Setting row: label on left, control on right. */
function Row({ label, description, children }: { label: string; description: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between py-3">
            <div className="flex-1 min-w-0 mr-4">
                <div className="text-sm font-medium">{label}</div>
                {description && <div className="text-xs opacity-50">{description}</div>}
            </div>
            {children}
        </div>
    );
}
