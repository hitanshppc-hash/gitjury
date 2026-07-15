"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Gauge, Trophy, TrendingDown, ScrollText, Loader2, ShieldAlert } from "lucide-react";
import StatTile from "@/components/admin/StatTile";
import { cn, scoreBand } from "@/lib/utils";

const BAND_COLOR = { high: "#34d399", mid: "#fbbf24", low: "#f87171" };

function ScoreBadge({ score }) {
  const band = scoreBand(score);
  return (
    <span
      className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
      style={{ color: BAND_COLOR[band], background: `${BAND_COLOR[band]}20` }}
    >
      {score}
    </span>
  );
}

function RepoRow({ entry, reasonLabel, reason }) {
  return (
    <div className="py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-mono text-foreground hover:text-accent transition-colors truncate"
        >
          {entry.slug}
        </a>
        <ScoreBadge score={entry.score} />
      </div>
      <p className="text-xs text-muted-dim mt-0.5">
        {entry.track} · {entry.verdictTag}
      </p>
      {reason && (
        <p className="text-xs text-muted mt-1">
          <span className="text-muted-dim">{reasonLabel}:</span> {reason}
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-accent mb-2">
          <Gauge size={20} />
          <span className="font-mono text-xs tracking-widest uppercase text-muted-dim">GitJury Admin</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Judging analytics</h1>
        <p className="text-muted text-sm mt-2 max-w-2xl">
          Aggregated from every repo GitJury has judged and cached. This view has no access
          control yet — treat it as internal until auth is added.
        </p>
      </header>

      {loading && (
        <div className="gj-card p-10 flex items-center justify-center gap-2 text-muted-dim text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading analytics…
        </div>
      )}

      {error && (
        <div className="gj-card p-4 border-score-low/30 flex items-center gap-2 text-sm text-muted">
          <ShieldAlert size={16} className="text-score-low" /> {error}
        </div>
      )}

      {stats && stats.total === 0 && (
        <div className="gj-card p-10 text-center text-muted-dim text-sm">
          No repos judged yet — analytics will populate as GitJury judges repos.
        </div>
      )}

      {stats && stats.total > 0 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Repos analyzed" value={stats.total} accent />
            <StatTile label="Average score" value={stats.avgScore} />
            <StatTile label="Tracks represented" value={stats.trackBreakdown.length} />
            <StatTile
              label="Production-ready"
              value={stats.verdictTagBreakdown.find((t) => t.tag === "Production-Ready")?.count || 0}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="gj-card p-5">
              <p className="text-sm font-semibold mb-4">Score distribution</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--background-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.scoreDistribution.map((b, i) => (
                        <Cell key={i} fill="var(--accent)" fillOpacity={0.35 + i * 0.16} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="gj-card p-5">
              <p className="text-sm font-semibold mb-4">Tracks (auto-classified)</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.trackBreakdown} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="track"
                      width={130}
                      tick={{ fill: "var(--muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "var(--background-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name, props) => [`${value} repos, avg ${props.payload.avgScore}`, "count"]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="var(--accent)" fillOpacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="gj-card p-5">
            <p className="text-sm font-semibold mb-4">Average score per rubric category</p>
            <div className="space-y-2.5">
              {stats.categoryAverages.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted">{c.label}</span>
                    <span className="font-mono text-foreground">{c.avg}/{c.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-background-elevated overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.avg / c.max) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="gj-card p-5">
              <div className="flex items-center gap-2 text-score-high text-sm font-semibold mb-1">
                <Trophy size={15} /> Top performers
              </div>
              <div>
                {stats.topBest.map((e) => (
                  <RepoRow key={e.slug} entry={e} reasonLabel="Strongest" reason={e.topReason} />
                ))}
              </div>
            </div>

            <div className="gj-card p-5">
              <div className="flex items-center gap-2 text-muted text-sm font-semibold mb-1">
                <ScrollText size={15} /> Median
              </div>
              <div>
                {stats.median.map((e) => (
                  <RepoRow key={e.slug} entry={e} />
                ))}
              </div>
            </div>

            <div className="gj-card p-5">
              <div className="flex items-center gap-2 text-score-low text-sm font-semibold mb-1">
                <TrendingDown size={15} /> Lowest scoring
              </div>
              <div>
                {stats.topWorst.map((e) => (
                  <RepoRow key={e.slug} entry={e} reasonLabel="Weakest" reason={e.weakestReason} />
                ))}
              </div>
            </div>
          </div>

          <div className="gj-card p-5">
            <p className="text-sm font-semibold mb-4">Recently judged</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-dim border-b border-border">
                    <th className="pb-2 font-normal">Repo</th>
                    <th className="pb-2 font-normal">Track</th>
                    <th className="pb-2 font-normal">Score</th>
                    <th className="pb-2 font-normal">Verdict</th>
                    <th className="pb-2 font-normal">When</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((r) => (
                    <tr key={r.slug} className="border-b border-border/40 last:border-0">
                      <td className="py-2 font-mono text-xs">{r.slug}</td>
                      <td className="py-2 text-xs text-muted-dim">{r.track}</td>
                      <td className="py-2"><ScoreBadge score={r.score} /></td>
                      <td className="py-2 text-xs text-muted">{r.verdictTag}</td>
                      <td className="py-2 text-xs text-muted-dim">
                        {r.judgedAt ? new Date(r.judgedAt).toLocaleString() : "—"}
                        {r.fromCache && <span className="ml-1.5 text-accent">(cached)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
