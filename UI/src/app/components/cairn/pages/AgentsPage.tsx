import { motion } from "motion/react";
import { ArrowLeft, Plus, Share2 } from "lucide-react";

export function AgentsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full p-8 bg-[#F3F2EE] text-[#1A1D21]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-[#1A1D21]/5 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold tracking-tight">Agent Orchestration</h2>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1D21] text-[#F3F2EE] rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus size={16} />
                New Agent
            </button>
        </div>

        {/* Content - Graph Placeholder */}
        <div className="flex-1 border border-[#1A1D21]/10 rounded-lg relative overflow-hidden bg-white/50">
             <div className="absolute inset-0 grid grid-cols-[repeat(20,minmax(0,1fr))] grid-rows-[repeat(20,minmax(0,1fr))] opacity-10 pointer-events-none">
                {Array.from({ length: 400 }).map((_, i) => (
                    <div key={i} className="border-r border-b border-[#1A1D21]" />
                ))}
            </div>
            
            {/* Mock Nodes */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-1/4 left-1/4 w-48 p-4 bg-[#F3F2EE] border border-[#1A1D21] shadow-sm rounded-lg"
            >
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm">Manager</span>
                    <Share2 size={12} className="opacity-50" />
                </div>
                <div className="text-xs opacity-60">Router & Delegation</div>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="absolute top-1/2 left-1/2 w-48 p-4 bg-[#1A1D21] text-[#F3F2EE] border border-[#1A1D21] shadow-sm rounded-lg"
            >
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm">Writer</span>
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="text-xs opacity-60">Content Generation</div>
            </motion.div>
             
             {/* Connector Line (SVG) */}
             <svg className="absolute inset-0 pointer-events-none">
                <path d="M 350 200 C 450 200, 450 400, 550 400" fill="none" stroke="#1A1D21" strokeWidth="2" strokeDasharray="4 4" />
             </svg>
        </div>
    </div>
  );
}
