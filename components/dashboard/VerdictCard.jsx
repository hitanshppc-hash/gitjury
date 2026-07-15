"use client";

import { motion } from "framer-motion";
import { Star, GitFork, AlertTriangle, ChevronRight, RotateCw } from "lucide-react";
import { cn, scoreBand } from "@/lib/utils";
import ScoreRing from "./ScoreRing";

const BAND_BG = {
  high: "bg-score-high-soft text-score-high border-score-high/30",
  mid: "bg-score-mid-soft text-score-mid border-score-mid/30",
  low: "bg-score-low-soft text-score-low border-score-low/30",
};

export default function VerdictCard({ result, onOpen, onRetry, index, retrying }) {
  if (!result.ok) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
        className="gj-card p-5 border-score-low/30"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 text-score-low">
            <AlertTriangle size={16} />
            <span className="text-sm font-semibold">Could not judge this repo</span>
          </div>
          {onRetry && (
            <button
              onClick={() => onRetry(result.input)}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCw size={12} className={retrying ? "animate-spin" : ""} />
              {retrying ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>
        <p className="text-xs font-mono text-muted mb-1">{result.slug || result.input}</p>
        <p className="text-sm text-muted">{result.error}</p>
      </motion.div>
    );
  }

  const { verdict, repoMeta, slug } = result;
  const band = scoreBand(verdict.overallScore);
  const categories = Object.values(verdict.categories);

  return (
    <motion.button
      onClick={() => onOpen(result)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className="gj-card text-left p-5 hover:border-border-strong transition-colors group w-full"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-foreground truncate">{slug}</p>
          {repoMeta?.description && (
            <p className="text-xs text-muted-dim mt-0.5 line-clamp-1">{repoMeta.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={cn(
                "inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                BAND_BG[band],
              )}
            >
              {verdict.verdictTag}
            </span>
            {verdict.track && (
              <span className="inline-block text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-dim">
                {verdict.track}
              </span>
            )}
          </div>
        </div>
        <ScoreRing score={verdict.overallScore} size={64} strokeWidth={6} />
      </div>

      <p className="text-sm text-muted mt-3 line-clamp-2">{verdict.summary}</p>

      <div className="mt-4 space-y-1.5">
        {categories.slice(0, 4).map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-dim w-28 shrink-0 truncate">{c.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-background-elevated overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(c.score / c.max) * 100}%` }}
                transition={{ delay: 0.3 + index * 0.05, duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-accent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center gap-3 text-xs text-muted-dim">
          {typeof repoMeta?.stars === "number" && (
            <span className="inline-flex items-center gap-1">
              <Star size={12} /> {repoMeta.stars.toLocaleString()}
            </span>
          )}
          {typeof repoMeta?.forks === "number" && (
            <span className="inline-flex items-center gap-1">
              <GitFork size={12} /> {repoMeta.forks.toLocaleString()}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          Full verdict <ChevronRight size={14} />
        </span>
      </div>
    </motion.button>
  );
}
