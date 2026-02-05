import { useEffect, useRef, useState } from "react";
import { LogEntry, LogType } from "./types";
import { clsx } from "clsx";
import { motion, AnimatePresence } from "motion/react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LogType | 'all'>('all');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.type === filter);

  const cycleFilter = () => {
    const types: (LogType | 'all')[] = ['all', 'thought', 'tool', 'error'];
    const nextIndex = (types.indexOf(filter) + 1) % types.length;
    setFilter(types[nextIndex]);
  };

  return (
    <div className={clsx("grid grid-rows-[auto,minmax(0,1fr)] h-full p-4 min-h-0", className)}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs uppercase tracking-widest font-bold opacity-40">System Logs</h3>
          {filter !== 'all' && (
            <span className="text-[10px] px-1 bg-[#1A1D21]/5 rounded opacity-50 uppercase tracking-tighter">{filter}</span>
          )}
        </div>
        <button onClick={cycleFilter} className={clsx("transition-opacity", filter === 'all' ? "opacity-30 hover:opacity-100" : "opacity-100")}>
          <Filter size={12} />
        </button>
      </div>

      <div ref={scrollRef} className="overflow-y-auto font-mono text-xs space-y-3 min-h-0 max-h-full overscroll-contain pointer-events-auto pr-2">
        <AnimatePresence initial={false}>
          {filteredLogs.map((log) => {
            const Icon = ICON_MAP[log.type] || Brain;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                className={clsx(
                  "flex gap-3 items-start",
                  log.type === 'error' ? "text-red-900" : "opacity-70"
                )}
              >
                <span className="opacity-30 min-w-[50px]">{log.timestamp}</span>
                <Icon size={12} className="mt-0.5 opacity-50 shrink-0" />
                <span className={clsx(
                  "leading-snug break-all",
                  log.type === 'thought' && "italic opacity-50"
                )}>
                  {log.content}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
