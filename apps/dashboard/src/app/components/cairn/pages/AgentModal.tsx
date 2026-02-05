import { X, Cpu, Shield, Zap, Database, Check } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface AgentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AgentModal({ isOpen, onClose }: AgentModalProps) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [model, setModel] = useState("gpt-4o-mini");

    if (!isOpen) return null;

    const handleCreate = () => {
        setStep(2);
        setTimeout(() => {
            onClose();
            setStep(1);
            setName("");
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-[#1A1D21]/40 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-[#F3F2EE] border border-[#1A1D21]/20 rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Configure New Agent</h3>
                        <button onClick={onClose} className="p-1 hover:bg-[#1A1D21]/5 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div
                                key="step-1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-xs uppercase tracking-widest opacity-50 mb-1.5 font-bold">Node Identity</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. researcher, auditor"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-white border border-[#1A1D21]/10 rounded-lg px-4 py-3 text-sm focus:border-[#1A1D21] outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-widest opacity-50 mb-1.5 font-bold">Assigned Model</label>
                                    <select
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="w-full bg-white border border-[#1A1D21]/10 rounded-lg px-4 py-3 text-sm focus:border-[#1A1D21] outline-none transition-colors appearance-none"
                                    >
                                        <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                                        <option value="gpt-4o">GPT-4o (Strong)</option>
                                        <option value="o1-preview">o1 Preview (Reasoning)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-widest opacity-50 mb-1.5 font-bold">Access Tier</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['hot', 'warm', 'cold'].map(tier => (
                                            <div key={tier} className="flex items-center gap-2 p-2 bg-[#1A1D21]/5 rounded-lg border border-[#1A1D21]/5">
                                                <div className={`w-2 h-2 rounded-full ${tier === 'hot' ? 'bg-orange-400' : tier === 'warm' ? 'bg-blue-400' : 'bg-gray-400'}`} />
                                                <span className="text-[10px] uppercase font-bold">{tier}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={handleCreate}
                                        disabled={!name.trim()}
                                        className="w-full bg-[#1A1D21] text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-20"
                                    >
                                        Initialize Agent
                                    </button>
                                </div>
                                <p className="text-[10px] text-center opacity-40">Note: New agents require a policy update to be authorized in production.</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step-2"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center py-12"
                            >
                                <div className="w-16 h-16 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mb-4">
                                    <Check size={32} />
                                </div>
                                <h4 className="text-lg font-bold mb-1">Agent Initialized</h4>
                                <p className="text-sm opacity-50">Node "{name}" registered with kernel.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
