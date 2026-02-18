import { memo, useState, useRef, useEffect } from "react";
import type { ChatMessage, ChatAttachment, ChatActivity } from "./types";
import { clsx } from "clsx";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Paperclip, Send, X } from "lucide-react";
import { useTheme } from "../../theme";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

interface ChatProps {
  messages: ChatMessage[];
  onSend?: (text: string, attachments?: ChatAttachment[]) => void;
  className?: string;
  darkMode?: boolean;
  chatActivity?: ChatActivity;
  connected?: boolean;
}

export function Chat({ messages, onSend, className, darkMode = false, chatActivity, connected = true }: ChatProps) {
  const theme = useTheme(darkMode);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // reset so same file can be re-selected

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_SIZE) continue;

      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          type: "image",
          mimeType: file.type,
          dataUrl: reader.result as string,
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if ((trimmed || attachments.length > 0) && onSend) {
      onSend(trimmed, attachments.length > 0 ? attachments : undefined);
      setInput("");
      setAttachments([]);
    }
  };

  return (
    <div className={clsx("flex flex-col h-full overflow-y-auto p-4 font-mono text-sm", className)}>
      <ChatActivityBanner
        activity={chatActivity}
        borderColor={theme.border}
        backgroundColor={theme.subtleBg}
      />

      <MessageFeed messages={messages} borderColor={theme.border} />

      {/* Input area */}
      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${theme.border}` }}>
        {/* Attachment preview strip */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {attachments.map(att => (
              <div key={att.id} className="relative group">
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="h-16 w-16 object-cover rounded"
                  style={{ border: `1px solid ${theme.border}` }}
                />
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: theme.subtleBg }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Input row */}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="opacity-30 hover:opacity-70 transition-opacity shrink-0"
            title="Attach image"
          >
            <Paperclip size={16} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type to Cairn..."
            className="flex-1 bg-transparent outline-none placeholder:opacity-30"
          />
          <button
            type="submit"
            className="rounded px-2 py-1 text-xs border transition-opacity disabled:opacity-40"
            style={{ borderColor: theme.border }}
            disabled={(!input.trim() && attachments.length === 0) || !connected}
          >
            <span className="inline-flex items-center gap-1">
              <Send size={12} />
              Send
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </form>
        {!connected && (
          <div className="text-[10px] mt-2 opacity-60 uppercase tracking-wider">
            Disconnected — messages won’t send until socket reconnects.
          </div>
        )}
      </div>
    </div>
  );
}

const MessageFeed = memo(function MessageFeed({ messages, borderColor }: { messages: ChatMessage[]; borderColor: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2 text-xs opacity-50 select-none">
            <span>{msg.timestamp}</span>
            <span className="uppercase tracking-wider font-bold">
              {msg.role}{msg.source === "telegram" ? " (telegram)" : ""}
            </span>
            {msg.deliveryStatus && (
              <span className="uppercase tracking-wider opacity-70">
                {msg.deliveryStatus === "queued" && "queued"}
                {msg.deliveryStatus === "sent" && "sent"}
                {msg.deliveryStatus === "thinking" && "thinking"}
                {msg.deliveryStatus === "failed" && "failed"}
              </span>
            )}
          </div>
          {msg.text && (
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.text}
            </div>
          )}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex gap-2 mt-1 flex-wrap">
              {msg.attachments.map(att => (
                <img
                  key={att.id}
                  src={att.dataUrl}
                  alt={att.name}
                  className="max-w-xs max-h-48 rounded object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ border: `1px solid ${borderColor}` }}
                  onClick={() => window.open(att.dataUrl, '_blank')}
                />
              ))}
            </div>
          )}
          {msg.tools && msg.tools.length > 0 && (
            <ToolOutputs tools={msg.tools} />
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
});

function ChatActivityBanner({
  activity,
  borderColor,
  backgroundColor,
}: {
  activity?: ChatActivity;
  borderColor: string;
  backgroundColor: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activity?.active || !activity.startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activity?.active, activity?.startedAt]);

  if (!activity?.active) return null;

  const activitySeconds = activity.startedAt
    ? Math.max(0, Math.floor((now - activity.startedAt) / 1000))
    : 0;

  return (
    <div
      className="mb-3 rounded-md px-3 py-2 text-xs flex items-center justify-between"
      style={{ border: `1px solid ${borderColor}`, backgroundColor }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {activity.phase === "failed" ? (
          <AlertTriangle size={14} className="shrink-0" />
        ) : (
          <Loader2 size={14} className="animate-spin shrink-0" />
        )}
        <span className="truncate">{activity.label}</span>
      </div>
      <span className="opacity-60 ml-3 whitespace-nowrap">
        {activity.pendingCount > 0 ? `${activity.pendingCount} pending` : ""}
        {activitySeconds > 0 ? ` • ${activitySeconds}s` : ""}
      </span>
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
        <div className="mt-1 pl-4 border-l border-current/20 space-y-1">
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
