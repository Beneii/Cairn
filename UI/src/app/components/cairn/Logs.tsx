import { LogEntry } from "./types";
import { clsx } from "clsx";
import { 
  Brain, 
  Wrench, 
  FileText, 
  Globe, 
  Bot, 
  AlertTriangle, 
  Filter
} from "lucide-react";

interface LogsProps {
  logs: LogEntry[];
  className?: string;
}

const ICON_MAP = {
  thought: Brain,
  tool: Wrench,
  file: FileText,
  api: Globe,
  agent: Bot,
  error: AlertTriangle
};

export function Logs({ logs, className }: LogsProps) {
  return (
    <div className={clsx("flex flex-col h-full p-4", className)}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs uppercase tracking-widest font-bold opacity-40">System Logs</h3>
        <button className="opacity-30 hover:opacity-100">
           <Filter size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-3">
        {logs.map((log) => {
           const Icon = ICON_MAP[log.type] || Brain;
           return (
             <div key={log.id} className={clsx(
                "flex gap-3 items-start",
                log.type === 'error' ? "text-red-900" : "opacity-70"
             )}>
                <span className="opacity-30 min-w-[50px]">{log.timestamp}</span>
                <Icon size={12} className="mt-0.5 opacity-50 shrink-0" />
                <span className={clsx(
                   "leading-snug break-all",
                   log.type === 'thought' && "italic opacity-50"
                )}>
                   {log.content}
                </span>
             </div>
           );
        })}
      </div>
    </div>
  );
}
