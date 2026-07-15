"use client";

import { motion } from "framer-motion";
import { Gavel, Square } from "lucide-react";

export default function LoadingState({ count, progress, onCancel }) {
  const isBatch = progress && progress.total > progress.chunkSize;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="gj-card p-8 flex flex-col items-center justify-center gap-4 text-center">
      <motion.div
        animate={{ rotate: [0, -25, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        className="text-accent"
      >
        <Gavel size={32} />
      </motion.div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {isBatch
            ? `Deliberating — ${progress.done}/${progress.total} judged`
            : `Deliberating on ${count} repo${count === 1 ? "" : "s"}…`}
        </p>
        <p className="text-xs text-muted-dim mt-1">
          Reading the file tree, README, and manifests, then weighing it against the rubric.
        </p>
      </div>

      {isBatch ? (
        <div className="w-full max-w-xs space-y-3">
          <div className="h-1.5 rounded-full bg-background-elevated overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full rounded-full bg-accent"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-dim">
            <span className="font-mono">{pct}%</span>
            {onCancel && (
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 hover:text-score-low transition-colors"
              >
                <Square size={11} /> Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              className="w-1.5 h-1.5 rounded-full bg-accent"
            />
          ))}
        </div>
      )}
    </div>
  );
}
