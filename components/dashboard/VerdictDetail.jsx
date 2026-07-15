"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useState } from "react";
import {
  X,
  Download,
  Star,
  GitFork,
  CircleAlert,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Wrench,
  Cpu,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { cn, scoreBand, cleanModelName } from "@/lib/utils";
import ScoreRing from "./ScoreRing";
import { downloadJSON, buildReport, buildMarkdownReport, copyToClipboard } from "@/lib/export";

const PRIORITY_STYLE = {
  high: "bg-score-low-soft text-score-low border-score-low/30",
  medium: "bg-score-mid-soft text-score-mid border-score-mid/30",
  low: "bg-score-high-soft text-score-high border-score-high/30",
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-background-elevated border border-border rounded-lg px-3 py-2 text-xs max-w-56">
      <p className="font-semibold text-foreground mb-0.5">{p.label}</p>
      <p className="text-accent font-mono">{p.score} / {p.max}</p>
      {p.justification && <p className="text-muted mt-1">{p.justification}</p>}
    </div>
  );
}

export default function VerdictDetail({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  const { verdict, repoMeta, slug, url, transparency } = result;
  const band = scoreBand(verdict.overallScore);

  async function handleCopy() {
    await copyToClipboard(buildMarkdownReport(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const radarData = Object.values(verdict.categories).map((c) => ({
    label: c.label.replace(" & ", " &\n"),
    score: c.score,
    max: c.max,
    fullMark: c.max,
    justification: c.justification,
  }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="gj-card w-full max-w-3xl my-4 sm:my-0 max-h-[92vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-border p-5 flex items-start justify-between gap-4 z-10">
            <div className="min-w-0">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-foreground hover:text-accent transition-colors truncate block"
              >
                {slug}
              </a>
              <p className="text-xs text-muted-dim mt-1">{repoMeta?.description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-surface-hover text-muted hover:text-foreground transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <ScoreRing score={verdict.overallScore} size={110} strokeWidth={9} />
              <div className="flex-1 text-center sm:text-left">
                <span
                  className={cn(
                    "inline-block text-xs font-semibold px-2.5 py-1 rounded-full border mb-2",
                    band === "high" && "bg-score-high-soft text-score-high border-score-high/30",
                    band === "mid" && "bg-score-mid-soft text-score-mid border-score-mid/30",
                    band === "low" && "bg-score-low-soft text-score-low border-score-low/30",
                  )}
                >
                  {verdict.verdictTag}
                </span>
                {verdict.track && (
                  <span className="inline-block text-xs px-2.5 py-1 rounded-full border border-border text-muted-dim mb-2 ml-1.5">
                    {verdict.track}
                  </span>
                )}
                <p className="text-sm text-foreground leading-relaxed">{verdict.summary}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-muted-dim">
                  {typeof repoMeta?.stars === "number" && (
                    <span className="inline-flex items-center gap-1"><Star size={12} />{repoMeta.stars.toLocaleString()}</span>
                  )}
                  {typeof repoMeta?.forks === "number" && (
                    <span className="inline-flex items-center gap-1"><GitFork size={12} />{repoMeta.forks.toLocaleString()}</span>
                  )}
                  {repoMeta?.license && <span>{repoMeta.license}</span>}
                  {typeof repoMeta?.lastPushDaysAgo === "number" && (
                    <span className="inline-flex items-center gap-1"><Clock size={12} />pushed {repoMeta.lastPushDaysAgo}d ago</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 items-center">
              <div className="h-64 sm:h-72 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} tick={false} axisLine={false} />
                    <Radar
                      dataKey="score"
                      stroke="var(--accent)"
                      fill="var(--accent)"
                      fillOpacity={0.35}
                      isAnimationActive
                      animationDuration={900}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5">
                {Object.values(verdict.categories).map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted">{c.label}</span>
                      <span className="font-mono text-foreground">{c.score}/{c.max}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-background-elevated overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(c.score / c.max) * 100}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full bg-accent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="gj-card p-4 bg-background-elevated">
                <div className="flex items-center gap-2 text-score-high text-sm font-semibold mb-2">
                  <ThumbsUp size={15} /> Strengths
                </div>
                <ul className="space-y-1.5 text-sm text-muted">
                  {verdict.strengths.length ? verdict.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-score-high mt-0.5">+</span>{s}</li>
                  )) : <li className="text-muted-dim">None noted.</li>}
                </ul>
              </div>
              <div className="gj-card p-4 bg-background-elevated">
                <div className="flex items-center gap-2 text-score-low text-sm font-semibold mb-2">
                  <ThumbsDown size={15} /> Weaknesses
                </div>
                <ul className="space-y-1.5 text-sm text-muted">
                  {verdict.weaknesses.length ? verdict.weaknesses.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-score-low mt-0.5">−</span>{s}</li>
                  )) : <li className="text-muted-dim">None noted.</li>}
                </ul>
              </div>
            </div>

            {verdict.improvements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold mb-2.5">
                  <Wrench size={15} className="text-accent" /> Suggested improvements
                </div>
                <div className="space-y-2">
                  {verdict.improvements.map((imp, i) => (
                    <div key={i} className="gj-card p-3.5 bg-background-elevated flex items-start gap-3">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5", PRIORITY_STYLE[imp.priority])}>
                        {imp.priority}
                      </span>
                      <div>
                        <p className="text-sm text-foreground font-medium">{imp.title}</p>
                        {imp.detail && <p className="text-xs text-muted mt-0.5">{imp.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verdict.starterCodeAssessment && (
              <div className="gj-card p-4 bg-background-elevated">
                <div className="flex items-center gap-2 text-sm font-semibold mb-1.5">
                  <CircleAlert size={15} className="text-accent" /> Current state
                </div>
                <p className="text-sm text-muted">{verdict.starterCodeAssessment}</p>
              </div>
            )}

            <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-dim">
                <ShieldCheck size={14} className="text-accent" />
                <span>Full transparency:</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Cpu size={12} />{cleanModelName(transparency?.modelUsed)}
                </span>
                <span>· {new Date(transparency?.judgedAt).toLocaleString()}</span>
                <span>· rubric sums to {verdict && Object.values(verdict.categories).reduce((s, c) => s + c.max, 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-background-elevated border border-border hover:border-border-strong transition-colors"
                >
                  {copied ? <Check size={14} className="text-score-high" /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy as Markdown"}
                </button>
                <button
                  onClick={() => downloadJSON(`gitjury-${result.slug.replace("/", "-")}.json`, buildReport(result))}
                  className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-background-elevated border border-border hover:border-border-strong transition-colors"
                >
                  <Download size={14} /> Download report
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
