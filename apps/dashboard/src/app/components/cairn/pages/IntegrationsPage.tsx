import { Check, Key, Globe, Eye, EyeOff, MessageCircle } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { PageLayout } from "../PageLayout";
import { PageContent } from "../PageContent";

export function IntegrationsSettings({
    hasOpenAI,
    setOpenAIKey,
    hasTelegram,
    setTelegramToken,
    telegramAdminChatId,
    setTelegramAdminChatId,
    hasGoogle = false,
    gatewayUrl = "http://localhost:3100",
    darkMode = false,
    mobileEnabled = false,
    defaultClient = "telegram",
    mobilePairingSecret = "",
    setMobileConfig
}: {
    hasOpenAI: boolean,
    setOpenAIKey: (key: string) => void,
    hasTelegram: boolean,
    setTelegramToken: (token: string) => void,
    telegramAdminChatId: string,
    setTelegramAdminChatId: (chatId: string) => void,
    hasGoogle?: boolean,
    gatewayUrl?: string,
    darkMode?: boolean,
    mobileEnabled?: boolean,
    defaultClient?: "telegram" | "mobile",
    mobilePairingSecret?: string,
    setMobileConfig?: (enabled: boolean, defaultClient: "telegram" | "mobile") => void
}) {
    const [connecting, setConnecting] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [telegramToken, setTelegramTokenInput] = useState("");
    const [adminChatId, setAdminChatIdInput] = useState("");
    const [showKey, setShowKey] = useState(false);

    const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';
    const cardBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)';
    const subtleBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(26,29,33,0.05)';
    const inputBg = darkMode ? 'rgba(255,255,255,0.08)' : '#ffffff';
    const inputBorder = darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(26,29,33,0.2)';
    const btnBg = darkMode ? '#E5E5E5' : '#1A1D21';
    const btnFg = darkMode ? '#1c1c1c' : '#F3F2EE';
    const checkBg = darkMode ? '#E5E5E5' : '#1A1D21';
    const checkFg = darkMode ? '#1c1c1c' : '#F3F2EE';

    const integrations = [
        { id: "openai", name: "OpenAI", type: "LLM Provider", connected: hasOpenAI },
        { id: "telegram", name: "Telegram", type: "Communication", connected: hasTelegram },
        { id: "mobile", name: "Mobile App", type: "Client", connected: mobileEnabled },
        { id: "anthropic", name: "Anthropic", type: "LLM Provider", connected: false },
        { id: "google", name: "Google Calendar", type: "OAuth", connected: hasGoogle },
        { id: "basiq", name: "Basiq", type: "Financial Data", connected: false },
        { id: "slack", name: "Slack", type: "Communication", connected: false },
    ];

    const handleSave = () => {
        if (apiKey.trim()) {
            setOpenAIKey(apiKey.trim());
            setApiKey("");
            setConnecting(null);
        }
    };

    const handleSaveTelegram = () => {
        if (telegramToken.trim()) {
            setTelegramToken(telegramToken.trim());
            setTelegramTokenInput("");
            setConnecting(null);
        }
    };

    const handleSaveAdminChatId = () => {
        if (adminChatId.trim()) {
            setTelegramAdminChatId(adminChatId.trim());
            setAdminChatIdInput("");
        }
    };

    return (
        <div className="space-y-4">
            {integrations.map((item) => (
                <div key={item.id} className="flex flex-col rounded-lg overflow-hidden" style={{ border: `1px solid ${border}`, backgroundColor: cardBg }}>
                    <div className="flex items-center justify-between p-4 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: subtleBg }}>
                                {item.id === "telegram" ? <MessageCircle size={20} /> : item.type === "OAuth" ? <Globe size={20} /> : <Key size={20} />}
                            </div>
                            <div>
                                <h3 className="text-sm font-medium">{item.name}</h3>
                                <p className="text-xs opacity-50">{item.type}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {item.connected && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 uppercase tracking-tighter">
                                    <Check size={12} />
                                    Connected
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    if (item.id === "google" && !hasGoogle) {
                                        window.open(`${gatewayUrl}/oauth/google`, "_blank");
                                        return;
                                    }
                                    setConnecting(connecting === item.id ? null : item.id);
                                }}
                                className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                                style={
                                    item.id === connecting
                                        ? { border: `1px solid ${border}`, backgroundColor: 'transparent' }
                                        : item.connected
                                            ? { border: `1px solid ${border}`, backgroundColor: 'transparent' }
                                            : { backgroundColor: btnBg, color: btnFg, border: `1px solid ${btnBg}` }
                                }
                            >
                                {item.id === connecting ? "Cancel" : item.connected ? "Update" : "Connect"}
                            </button>
                        </div>
                    </div>

                    {connecting === item.id && (
                        <div className="px-4 pb-4 pt-2 flex flex-col gap-4" style={{ borderTop: `1px solid ${border}`, backgroundColor: subtleBg }}>
                            {item.id === 'openai' ? (
                                <div className="space-y-3">
                                    <p className="text-xs opacity-60">Enter your OpenAI API key to enable LLM capabilities. This is stored locally in your .env file.</p>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type={showKey ? "text" : "password"}
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                placeholder="sk-..."
                                                className="w-full rounded-md pl-3 pr-10 py-2 text-sm outline-none"
                                                style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            />
                                            <button
                                                onClick={() => setShowKey(!showKey)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 p-1"
                                            >
                                                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleSave}
                                            disabled={!apiKey.trim()}
                                            className="px-6 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-30"
                                            style={{ backgroundColor: btnBg, color: btnFg }}
                                        >
                                            Save Key
                                        </button>
                                    </div>
                                </div>
                            ) : item.id === 'telegram' ? (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <p className="text-xs opacity-60">Enter your Telegram Bot Token to enable messaging via Telegram. Create a bot with @BotFather to get your token.</p>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type={showKey ? "text" : "password"}
                                                    value={telegramToken}
                                                    onChange={(e) => setTelegramTokenInput(e.target.value)}
                                                    placeholder="123456789:ABC..."
                                                    className="w-full rounded-md pl-3 pr-10 py-2 text-sm outline-none"
                                                    style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                                />
                                                <button
                                                    onClick={() => setShowKey(!showKey)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 p-1"
                                                >
                                                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                            <button
                                                onClick={handleSaveTelegram}
                                                disabled={!telegramToken.trim()}
                                                className="px-6 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-30"
                                                style={{ backgroundColor: btnBg, color: btnFg }}
                                            >
                                                Save Token
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-3" style={{ borderTop: `1px solid ${border}` }}>
                                        <p className="text-xs opacity-60">
                                            Admin Chat ID (optional): Your Telegram user ID to receive messages without needing to /start first.
                                            Message @userinfobot on Telegram to get your ID.
                                            {telegramAdminChatId && <span className="ml-1 font-medium">Current: {telegramAdminChatId}</span>}
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={adminChatId}
                                                onChange={(e) => setAdminChatIdInput(e.target.value)}
                                                placeholder="123456789"
                                                className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
                                                style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, color: 'inherit' }}
                                            />
                                            <button
                                                onClick={handleSaveAdminChatId}
                                                disabled={!adminChatId.trim()}
                                                className="px-6 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-30"
                                                style={{ backgroundColor: btnBg, color: btnFg }}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs opacity-40 italic">Note: Requires gateway restart to apply changes.</p>
                                </div>
                            ) : item.id === 'google' ? (
                                <div className="space-y-3">
                                    <p className="text-xs opacity-60">
                                        {hasGoogle
                                            ? "Google Calendar is connected. Calendar data is used for briefings, schedule awareness, and smart scheduling."
                                            : "Connect your Google account to enable calendar integration. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file."}
                                    </p>
                                    {!hasGoogle && (
                                        <button
                                            onClick={() => window.open(`${gatewayUrl}/oauth/google`, "_blank")}
                                            className="px-6 py-2 rounded-md text-sm font-medium transition-colors"
                                            style={{ backgroundColor: btnBg, color: btnFg }}
                                        >
                                            Connect Google Account
                                        </button>
                                    )}
                                </div>
                            ) : item.id === 'mobile' ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start gap-6">
                                        <div className="flex-1 space-y-3">
                                            <p className="text-xs opacity-60">
                                                Scan the QR code with your mobile app to pair it with Cairn.
                                                Keep this code private.
                                            </p>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm font-medium">Mobile App Integration</div>
                                                    <button
                                                        onClick={() => setMobileConfig?.(!mobileEnabled, defaultClient || "telegram")}
                                                        className="w-8 h-5 rounded-full transition-all relative"
                                                        style={{ backgroundColor: mobileEnabled ? checkBg : subtleBg }}
                                                    >
                                                        <div
                                                            className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                                                            style={{
                                                                backgroundColor: mobileEnabled ? checkFg : 'currentColor',
                                                                opacity: mobileEnabled ? 1 : 0.3,
                                                                left: mobileEnabled ? '14px' : '2px'
                                                            }}
                                                        />
                                                    </button>
                                                </div>
                                                <div className="text-xs opacity-50">Enable mobile app connectivity</div>
                                            </div>

                                            <div className="space-y-2 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm font-medium">Use as Default Client</div>
                                                    <button
                                                        onClick={() => setMobileConfig?.(!!mobileEnabled, defaultClient === "mobile" ? "telegram" : "mobile")}
                                                        disabled={!mobileEnabled}
                                                        className="w-8 h-5 rounded-full transition-all relative disabled:opacity-30"
                                                        style={{ backgroundColor: defaultClient === "mobile" ? checkBg : subtleBg }}
                                                    >
                                                        <div
                                                            className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                                                            style={{
                                                                backgroundColor: defaultClient === "mobile" ? checkFg : 'currentColor',
                                                                opacity: defaultClient === "mobile" ? 1 : 0.3,
                                                                left: defaultClient === "mobile" ? '14px' : '2px'
                                                            }}
                                                        />
                                                    </button>
                                                </div>
                                                <div className="text-xs opacity-50">Prioritize mobile notifications over Telegram</div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white rounded-lg">
                                            {mobilePairingSecret ? (
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(JSON.stringify({ secret: mobilePairingSecret, url: gatewayUrl }))}`}
                                                    alt="Pairing QR Code"
                                                    className="w-[120px] h-[120px]"
                                                />
                                            ) : (
                                                <div className="w-[120px] h-[120px] bg-gray-200 flex items-center justify-center text-xs text-gray-500 text-center p-2 rounded">
                                                    Generating Secret...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs py-4 opacity-40 italic">Integration for {item.name} is coming soon.</p>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
