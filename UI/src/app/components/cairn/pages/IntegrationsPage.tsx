import { ArrowLeft, Check, Key, Globe } from "lucide-react";

export function IntegrationsPage({ onBack }: { onBack: () => void }) {
    const integrations = [
        { name: "OpenAI", type: "LLM Provider", connected: true },
        { name: "Anthropic", type: "LLM Provider", connected: false },
        { name: "Google Workspace", type: "OAuth", connected: true },
        { name: "Basiq", type: "Financial Data", connected: false },
        { name: "Slack", type: "Communication", connected: false },
    ];

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
                <div key={item.name} className="flex items-center justify-between p-6 border border-[#1A1D21]/10 bg-white/50 rounded-lg hover:border-[#1A1D21]/30 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#1A1D21]/5 rounded-md flex items-center justify-center">
                            {item.type === "OAuth" ? <Globe size={20} /> : <Key size={20} />}
                        </div>
                        <div>
                            <h3 className="font-medium">{item.name}</h3>
                            <p className="text-sm opacity-50">{item.type}</p>
                        </div>
                    </div>
                    <button className={`px-4 py-2 rounded-md text-sm font-medium border transition-all ${
                        item.connected 
                        ? "bg-[#1A1D21] text-[#F3F2EE] border-[#1A1D21]" 
                        : "bg-transparent border-[#1A1D21]/20 hover:border-[#1A1D21]"
                    }`}>
                        {item.connected ? "Connected" : "Connect"}
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
}
