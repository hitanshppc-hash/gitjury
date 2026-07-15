"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn, scoreBand } from "@/lib/utils";

const BAND_TEXT = {
  high: "text-score-high",
  mid: "text-score-mid",
  low: "text-score-low",
};

export default function Leaderboard({ results, onOpen }) {
  const ranked = results
    .filter((r) => r.ok)
    .slice()
    .sort((a, b) => b.verdict.overallScore - a.verdict.overallScore);

  if (ranked.length < 2) return null;

  return (
    <div className="gj-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold mb-4">
        <Trophy size={16} className="text-accent" />
        Leaderboard
      </div>
      <div className="space-y-2.5">
        {ranked.map((r, i) => {
          const band = scoreBand(r.verdict.overallScore);
          return (
            <motion.button
              key={r.slug}
              onClick={() => onOpen(r)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="w-full flex items-center gap-3 text-left group"
            >
              <span className="text-xs font-mono text-muted-dim w-5 shrink-0">#{i + 1}</span>
              <span className="text-sm font-mono text-foreground truncate flex-1 group-hover:text-accent transition-colors">
                {r.slug}
              </span>
              <div className="w-28 h-1.5 rounded-full bg-background-elevated overflow-hidden hidden sm:block">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${r.verdict.overallScore}%` }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-accent"
                />
              </div>
              <span className={cn("text-sm font-mono font-semibold w-8 text-right", BAND_TEXT[band])}>
                {r.verdict.overallScore}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
