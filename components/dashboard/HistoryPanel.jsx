"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, ChevronDown, Trash2, X } from "lucide-react";
import { cn, scoreBand } from "@/lib/utils";

const BAND_TEXT = {
  high: "text-score-high",
  mid: "text-score-mid",
  low: "text-score-low",
};

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function HistoryPanel({ history, onOpen, onRemove, onClear }) {
  const [expanded, setExpanded] = useState(false);
  if (!history.length) return null;

  return (
    <div className="gj-card">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History size={16} className="text-accent" />
          Past verdicts
          <span className="text-xs font-mono text-muted-dim">({history.length})</span>
        </div>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="text-muted-dim">
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1">
              {history.map((r) => {
                const band = scoreBand(r.verdict.overallScore);
                return (
                  <div
                    key={r.slug}
                    className="flex items-center gap-3 py-1.5 group rounded-md hover:bg-surface-hover px-1.5 -mx-1.5"
                  >
                    <button
                      onClick={() => onOpen(r)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    >
                      <span className={cn("text-sm font-mono font-semibold w-8 shrink-0", BAND_TEXT[band])}>
                        {r.verdict.overallScore}
                      </span>
                      <span className="text-sm font-mono text-foreground truncate">{r.slug}</span>
                      <span className="text-xs text-muted-dim shrink-0 ml-auto hidden sm:block">
                        {timeAgo(r.transparency?.judgedAt)}
                      </span>
                    </button>
                    <button
                      onClick={() => onRemove(r.slug)}
                      className="opacity-0 group-hover:opacity-100 text-muted-dim hover:text-score-low transition-opacity shrink-0"
                      aria-label="Remove from history"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={onClear}
                className="inline-flex items-center gap-1.5 text-xs text-muted-dim hover:text-score-low transition-colors pt-2"
              >
                <Trash2 size={12} /> Clear history
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
