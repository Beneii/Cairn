import { useEffect, useMemo, useRef, useState } from "react";
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
import { useTheme } from "../../theme";

interface LogsProps {
  logs: LogEntry[];
  className?: string;
  darkMode?: boolean;
}

const ICON_MAP = {
  thought: Brain,
  tool: Wrench,
  file: FileText,
  api: Globe,
  agent: Bot,
  error: AlertTriangle
};

const MAX_VISIBLE_LOGS = 200;

export function Logs({ logs, className, darkMode = false }: LogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LogType | 'all'>('all');
  const theme = useTheme(darkMode);

  const filteredLogs = useMemo(() => {
    const source = filter === 'all' ? logs : logs.filter((l) => l.type === filter);
    if (source.length <= MAX_VISIBLE_LOGS) return source;
    return source.slice(-MAX_VISIBLE_LOGS);
  }, [logs, filter]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const node = scrollRef.current;
    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const shouldStick = distanceToBottom < 80;
    if (shouldStick) {
      node.scrollTop = node.scrollHeight;
    }
  }, [filteredLogs]);

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
            <span className="text-[10px] px-1 rounded opacity-50 uppercase tracking-tighter" style={{ backgroundColor: theme.subtleBg }}>{filter}</span>
          )}
          {logs.length > MAX_VISIBLE_LOGS && (
            <span className="text-[10px] opacity-40" aria-label={`Showing latest ${MAX_VISIBLE_LOGS} logs`}>
              showing latest {MAX_VISIBLE_LOGS}
            </span>
          )}
        </div>
        <button onClick={cycleFilter} className={clsx("transition-opacity", filter === 'all' ? "opacity-30 hover:opacity-100" : "opacity-100") }>
          <Filter size={12} />
        </button>
      </div>

      <div ref={scrollRef} className="overflow-y-auto font-mono text-xs space-y-3 min-h-0 max-h-full overscroll-contain pointer-events-auto pr-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {filteredLogs.map((log) => {
            const Icon = ICON_MAP[log.type] || Brain;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.14 }}
                className={clsx(
                  "flex gap-3 items-start",
                  log.type === 'error'
                    ? (darkMode ? "text-red-400" : "text-red-900")
                    : "opacity-70"
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
