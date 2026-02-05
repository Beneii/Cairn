import { ArrowLeft } from "lucide-react";
import { PolicyGraph } from "../PolicyGraph";

export function AgentsPage({
    onBack,
    nodes,
    edges
}: {
    onBack: () => void,
    nodes: Record<string, any>,
    edges: Record<string, string[]>
}) {
    return (
        <div className="flex flex-col h-full bg-[#F3F2EE] text-[#1A1D21]">
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-[#1A1D21]/10">
                <button onClick={onBack} className="p-2 hover:bg-[#1A1D21]/5 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold tracking-tight">Agent Orchestration Graph</h2>
                <div className="ml-auto text-xs opacity-40">
                    {Object.keys(nodes).length} nodes • {Object.keys(edges).reduce((acc, key) => acc + edges[key].length, 0)} edges
                </div>
            </div>

            {/* Graph View */}
            <div className="flex-1 relative">
                <PolicyGraph nodes={nodes} edges={edges} />
            </div>
        </div>
    );
}
