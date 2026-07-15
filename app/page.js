"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gavel, Scale, ShieldCheck, AlertCircle, Sheet } from "lucide-react";
import RepoInputForm from "@/components/dashboard/RepoInputForm";
import LoadingState from "@/components/dashboard/LoadingState";
import VerdictCard from "@/components/dashboard/VerdictCard";
import VerdictDetail from "@/components/dashboard/VerdictDetail";
import Leaderboard from "@/components/dashboard/Leaderboard";
import HistoryPanel from "@/components/dashboard/HistoryPanel";
import ResultsToolbar, { sortAndFilterResults } from "@/components/dashboard/ResultsToolbar";
import { RUBRIC } from "@/lib/rubric";
import { getHistory, addToHistory, removeFromHistory, clearHistory } from "@/lib/history";
import { buildCsvSummary, downloadCSV } from "@/lib/export";

const CHUNK_SIZE = 10;

export default function DashboardPage() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [progress, setProgress] = useState(null); // { done, total, chunkSize }
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [retrying, setRetrying] = useState(() => new Set());
  const [sortBy, setSortBy] = useState("score_desc");
  const [filterTag, setFilterTag] = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  async function analyze(urls, { forceRefresh = false } = {}) {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrls: urls, forceRefresh }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data.results;
  }

  async function handleSubmit(urls) {
    cancelRef.current = false;
    setIsLoading(true);
    setPendingCount(urls.length);
    setError(null);
    setFilterTag(null);
    setResults([]);
    setProgress({ done: 0, total: urls.length, chunkSize: CHUNK_SIZE });

    const chunks = [];
    for (let i = 0; i < urls.length; i += CHUNK_SIZE) chunks.push(urls.slice(i, i + CHUNK_SIZE));

    let all = [];
    try {
      for (const chunk of chunks) {
        if (cancelRef.current) break;
        const chunkResults = await analyze(chunk);
        all = [...all, ...chunkResults];
        setResults(all);
        setHistory(addToHistory(chunkResults));
        setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + chunk.length) }));
      }
    } catch (err) {
      setError(err.message || "Network error while judging.");
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }

  function handleCancel() {
    cancelRef.current = true;
  }

  async function handleRetry(input) {
    setRetrying((prev) => new Set(prev).add(input));
    try {
      const [fresh] = await analyze([input], { forceRefresh: true });
      setResults((prev) => prev.map((r) => (r.input === input ? fresh : r)));
      if (fresh.ok) setHistory(addToHistory([fresh]));
    } catch {
      // leave the existing failed card in place — user can retry again
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(input);
        return next;
      });
    }
  }

  function handleRemoveHistory(slug) {
    setHistory(removeFromHistory(slug));
  }

  function handleClearHistory() {
    setHistory(clearHistory());
  }

  function handleExportCsv() {
    downloadCSV(`gitjury-batch-${results.length}.csv`, buildCsvSummary(results));
  }

  const hasResults = results.length > 0;
  const visibleResults = sortAndFilterResults(results, { sortBy, filterTag });
  const showInlineLoading = isLoading && results.length === 0;
  const showBatchBar = isLoading && progress && progress.total > CHUNK_SIZE;

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10 text-center"
      >
        <div className="inline-flex items-center gap-2 text-accent mb-3">
          <Scale size={22} />
          <span className="font-mono text-xs tracking-widest uppercase text-muted-dim">GitJury</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          The fair judge for your repo
        </h1>
        <p className="text-muted mt-3 max-w-xl mx-auto text-sm sm:text-base">
          Drop in one GitHub repo, a batch of them, or upload a list. Get a transparent,
          evidence-backed verdict — what it is, what it scores, what to fix — backed by evidence, not vibes.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-5 text-xs text-muted-dim">
          {RUBRIC.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-accent" />
              {c.label} <span className="font-mono text-muted-dim/70">{c.max}</span>
            </span>
          ))}
        </div>
      </motion.header>

      <div className="space-y-6">
        <RepoInputForm onSubmit={handleSubmit} isLoading={isLoading} />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="gj-card p-4 border-score-low/30 flex items-start gap-2.5 text-sm"
            >
              <AlertCircle size={16} className="text-score-low shrink-0 mt-0.5" />
              <span className="text-muted">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!isLoading && history.length > 0 && (
          <HistoryPanel
            history={history}
            onOpen={setSelected}
            onRemove={handleRemoveHistory}
            onClear={handleClearHistory}
          />
        )}

        {showInlineLoading && <LoadingState count={pendingCount} />}

        {hasResults && (
          <>
            {showBatchBar && (
              <LoadingState count={pendingCount} progress={progress} onCancel={handleCancel} />
            )}
            <Leaderboard results={results} onOpen={setSelected} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ResultsToolbar
                results={results}
                sortBy={sortBy}
                setSortBy={setSortBy}
                filterTag={filterTag}
                setFilterTag={setFilterTag}
              />
              {results.length > 3 && (
                <button
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <Sheet size={13} /> Export all as CSV
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {visibleResults.map((r, i) => (
                <VerdictCard
                  key={r.slug || r.input}
                  result={r}
                  index={i}
                  onOpen={setSelected}
                  onRetry={handleRetry}
                  retrying={retrying.has(r.input)}
                />
              ))}
            </div>
          </>
        )}

        {!isLoading && !hasResults && !error && history.length === 0 && (
          <div className="text-center py-16 text-muted-dim">
            <Gavel size={28} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No verdicts yet — paste a repo above to get started.</p>
          </div>
        )}
      </div>

      <footer className="mt-16 pt-6 border-t border-border/60 flex flex-col items-center justify-center gap-2 text-xs text-muted-dim">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={13} />
          Every score is rubric-based, evidence-backed, and shows the model that judged it.
        </span>
        <a href="/admin" className="hover:text-foreground transition-colors">
          Admin analytics
        </a>
      </footer>

      {selected && <VerdictDetail result={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
