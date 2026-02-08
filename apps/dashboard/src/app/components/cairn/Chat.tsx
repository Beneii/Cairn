import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./types";
import { clsx } from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ChatProps {
  messages: ChatMessage[];
  onSend?: (text: string) => void;
  className?: string;
  darkMode?: boolean;
}

export function Chat({ messages, onSend, className, darkMode = false }: ChatProps) {
  const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed && onSend) {
      onSend(trimmed);
      setInput("");
    }
  };

  return (
    <div className={clsx("flex flex-col h-full overflow-y-auto p-4 font-mono text-sm", className)}>
      <div className="flex-1 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 text-xs opacity-50 select-none">
              <span>{msg.timestamp}</span>
              <span className="uppercase tracking-wider font-bold">
                {msg.role}{msg.source === "telegram" ? " (telegram)" : ""}
              </span>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.text}
            </div>
            {msg.tools && msg.tools.length > 0 && (
              <ToolOutputs tools={msg.tools} />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${border}` }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Type to Cairn..."
          className="w-full bg-transparent outline-none placeholder:opacity-30"
        />
      </div>
    </div>
  );
}

function ToolOutputs({ tools }: { tools: string[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-1">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs opacity-40 hover:opacity-100 transition-opacity"
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{tools.length} tool output{tools.length > 1 ? 's' : ''}</span>
      </button>
      {isOpen && (
        <div className="mt-1 pl-4 border-l border-[#1A1D21]/20 space-y-1">
          {tools.map((output, i) => (
            <div key={i} className="text-xs opacity-60 font-mono">
              {output}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
