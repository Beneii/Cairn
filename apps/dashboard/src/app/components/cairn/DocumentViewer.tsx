import React from "react";
import { X, Copy, Check, Download } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface DocumentViewerProps {
    title: string;
    content: string;
    onClose: () => void;
    darkMode?: boolean;
}

export function DocumentViewer({ title, content, onClose, darkMode = false }: DocumentViewerProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className={`relative w-full max-w-4xl max-h-full flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-2xl ${darkMode ? 'bg-[#0A0C10]' : 'bg-white'}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                    <div className="flex-1 min-w-0 mr-4">
                        <h2 className="text-xl font-bold tracking-tight truncate">{title}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                            title="Copy to clipboard"
                        >
                            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="opacity-60" />}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                            title="Download as Markdown"
                        >
                            <Download size={18} className="opacity-60" />
                        </button>
                        <div className="w-[1px] h-6 bg-white/10 mx-1" />
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <X size={18} className="opacity-60" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12">
                    <article className="prose prose-invert max-w-none 
            prose-headings:font-bold prose-headings:tracking-tight 
            prose-p:text-white/60 prose-p:leading-relaxed
            prose-strong:text-white prose-strong:font-bold
            prose-code:text-blue-400 prose-code:bg-blue-400/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/5 prose-pre:rounded-2xl
            prose-li:text-white/60
            prose-img:rounded-2xl">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </article>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl bg-white text-black font-bold text-sm tracking-tight hover:bg-white/90 transition-all"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
