import { ArrowLeft, Check, Key, Globe, Eye, EyeOff, MessageCircle } from "lucide-react";
import { useState } from "react";

export function IntegrationsPage({
    onBack,
    hasOpenAI,
    setOpenAIKey,
    hasTelegram,
    setTelegramToken,
    telegramAdminChatId,
    setTelegramAdminChatId
}: {
    onBack: () => void,
    hasOpenAI: boolean,
    setOpenAIKey: (key: string) => void,
    hasTelegram: boolean,
    setTelegramToken: (token: string) => void,
    telegramAdminChatId: string,
    setTelegramAdminChatId: (chatId: string) => void
}) {
    const [connecting, setConnecting] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [telegramToken, setTelegramTokenInput] = useState("");
    const [adminChatId, setAdminChatIdInput] = useState("");
    const [showKey, setShowKey] = useState(false);

    const integrations = [
        { id: "openai", name: "OpenAI", type: "LLM Provider", connected: hasOpenAI },
        { id: "telegram", name: "Telegram", type: "Communication", connected: hasTelegram },
        { id: "anthropic", name: "Anthropic", type: "LLM Provider", connected: false },
        { id: "google", name: "Google Workspace", type: "OAuth", connected: false },
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
        <div className="flex flex-col h-full p-8 bg-[#F3F2EE] text-[#1A1D21] max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 hover:bg-[#1A1D21]/5 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
            </div>

            <div className="grid gap-4">
                {integrations.map((item) => (
                    <div key={item.id} className="flex flex-col border border-[#1A1D21]/10 bg-white/50 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-6 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#1A1D21]/5 rounded-md flex items-center justify-center">
                                    {item.id === "telegram" ? <MessageCircle size={20} /> : item.type === "OAuth" ? <Globe size={20} /> : <Key size={20} />}
                                </div>
                                <div>
                                    <h3 className="font-medium">{item.name}</h3>
                                    <p className="text-sm opacity-50">{item.type}</p>
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
                                    onClick={() => setConnecting(connecting === item.id ? null : item.id)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-all ${item.id === connecting
                                            ? "bg-transparent border-[#1A1D21]/10"
                                            : item.connected
                                                ? "bg-transparent border-[#1A1D21]/10 hover:border-[#1A1D21]/30"
                                                : "bg-[#1A1D21] text-[#F3F2EE] border-[#1A1D21] hover:opacity-90"
                                        }`}
                                >
                                    {item.id === connecting ? "Cancel" : item.connected ? "Update" : "Connect"}
                                </button>
                            </div>
                        </div>

                        {connecting === item.id && (
                            <div className="px-6 pb-6 pt-2 border-t border-[#1A1D21]/5 bg-[#1A1D21]/[0.02] flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
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
                                                    className="w-full bg-white border border-[#1A1D21]/20 rounded-md pl-3 pr-10 py-2 text-sm focus:border-[#1A1D21] outline-none"
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
                                                className="bg-[#1A1D21] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#1A1D21]/90 transition-colors disabled:opacity-30"
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
                                                        className="w-full bg-white border border-[#1A1D21]/20 rounded-md pl-3 pr-10 py-2 text-sm focus:border-[#1A1D21] outline-none"
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
                                                    className="bg-[#1A1D21] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#1A1D21]/90 transition-colors disabled:opacity-30"
                                                >
                                                    Save Token
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-3 pt-3 border-t border-[#1A1D21]/10">
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
                                                    className="flex-1 bg-white border border-[#1A1D21]/20 rounded-md px-3 py-2 text-sm focus:border-[#1A1D21] outline-none"
                                                />
                                                <button
                                                    onClick={handleSaveAdminChatId}
                                                    disabled={!adminChatId.trim()}
                                                    className="bg-[#1A1D21] text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-[#1A1D21]/90 transition-colors disabled:opacity-30"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs opacity-40 italic">Note: Requires gateway restart to apply changes.</p>
                                    </div>
                                ) : (
                                    <p className="text-xs py-4 opacity-40 italic">Integration for {item.name} is coming soon.</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
