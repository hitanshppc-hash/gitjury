"use client";

import { ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const SORT_OPTIONS = [
  { value: "score_desc", label: "Highest score" },
  { value: "score_asc", label: "Lowest score" },
  { value: "recent", label: "Most recent" },
];

export function sortAndFilterResults(results, { sortBy, filterTag }) {
  let list = results.filter((r) => !r.ok || !filterTag || r.verdict.verdictTag === filterTag);

  const ok = list.filter((r) => r.ok);
  const failed = list.filter((r) => !r.ok);

  ok.sort((a, b) => {
    if (sortBy === "score_asc") return a.verdict.overallScore - b.verdict.overallScore;
    if (sortBy === "recent") {
      return new Date(b.transparency?.judgedAt || 0) - new Date(a.transparency?.judgedAt || 0);
    }
    return b.verdict.overallScore - a.verdict.overallScore; // score_desc default
  });

  return [...ok, ...failed];
}

export default function ResultsToolbar({ results, sortBy, setSortBy, filterTag, setFilterTag }) {
  const tags = [...new Set(results.filter((r) => r.ok).map((r) => r.verdict.verdictTag))];
  if (results.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 -mb-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilterTag(null)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-colors",
            !filterTag
              ? "bg-accent-soft text-accent border-accent/30"
              : "text-muted-dim border-border hover:text-foreground",
          )}
        >
          All ({results.length})
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => setFilterTag(tag === filterTag ? null : tag)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              filterTag === tag
                ? "bg-accent-soft text-accent border-accent/30"
                : "text-muted-dim border-border hover:text-foreground",
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-dim">
        <ArrowDownUp size={12} />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-background-elevated border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent/60"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
