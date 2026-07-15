"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Gavel, Plus, X, Loader2, Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractRepoUrls } from "@/lib/parseRepoList";

const EXAMPLES = [
  "facebook/react",
  "vercel/next.js",
  "tiangolo/fastapi",
];

const MAX_BULK_REPOS = 2000;

export default function RepoInputForm({ onSubmit, isLoading }) {
  const [rows, setRows] = useState([""]);
  const [bulk, setBulk] = useState(null); // { fileName, urls: string[] }
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  function updateRow(i, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? value : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, ""]);
  }

  function removeRow(i) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function handlePaste(i, e) {
    const text = e.clipboardData.getData("text");
    const pieces = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (pieces.length > 1) {
      e.preventDefault();
      setRows((prev) => {
        const next = [...prev];
        next.splice(i, 1, ...pieces);
        return next;
      });
    }
  }

  function fillExample(url) {
    setRows((prev) => {
      const trimmed = prev.filter((r) => r.trim());
      return [...trimmed, url];
    });
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setFileError(null);

    const text = await file.text();
    const urls = extractRepoUrls(text);

    if (!urls.length) {
      setFileError(`Found no github.com/owner/repo URLs in "${file.name}".`);
      return;
    }
    const capped = urls.slice(0, MAX_BULK_REPOS);
    if (urls.length > MAX_BULK_REPOS) {
      setFileError(`File had ${urls.length} URLs — using the first ${MAX_BULK_REPOS}.`);
    }
    setBulk({ fileName: file.name, urls: capped });
  }

  function clearBulk() {
    setBulk(null);
    setFileError(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (bulk?.urls.length) {
      onSubmit(bulk.urls);
      return;
    }
    const urls = rows.map((r) => r.trim()).filter(Boolean);
    if (urls.length) onSubmit(urls);
  }

  const hasAnyInput = bulk?.urls.length > 0 || rows.some((r) => r.trim());

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="gj-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Gavel size={16} className="text-accent" />
            <span>Paste one repo, many, or upload a list</span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <Upload size={13} />
            Upload .txt / .csv
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {fileError && <p className="text-xs text-score-mid">{fileError}</p>}

        {bulk ? (
          <div className="gj-card bg-background-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{bulk.fileName}</p>
                  <p className="text-xs text-muted-dim font-mono">{bulk.urls.length} repos loaded</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearBulk}
                className="p-1.5 text-muted-dim hover:text-foreground transition-colors rounded-md hover:bg-surface-hover shrink-0"
                aria-label="Clear uploaded list"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {bulk.urls.slice(0, 6).map((u) => (
                <span key={u} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted-dim">
                  {u.replace("https://github.com/", "")}
                </span>
              ))}
              {bulk.urls.length > 6 && (
                <span className="text-[11px] text-muted-dim px-1.5 py-0.5">+{bulk.urls.length - 6} more</span>
              )}
            </div>
            {bulk.urls.length > 20 && (
              <p className="text-xs text-muted-dim mt-3">
                Large batches are judged in small chunks and can take a while — free-tier
                models share a rate-limited pool. Results stream in as they finish; you can
                cancel anytime.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row}
                  onChange={(e) => updateRow(i, e.target.value)}
                  onPaste={(e) => handlePaste(i, e)}
                  placeholder="github.com/owner/repo"
                  className={cn(
                    "flex-1 bg-background-elevated border border-border rounded-lg px-3.5 py-2.5",
                    "text-sm font-mono placeholder:text-muted-dim placeholder:font-sans",
                    "focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20",
                    "transition-colors",
                  )}
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="p-2 text-muted-dim hover:text-foreground transition-colors rounded-md hover:bg-surface-hover shrink-0"
                    aria-label="Remove row"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {!bulk ? (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              <Plus size={15} />
              Add another repo
            </button>
          ) : (
            <span />
          )}

          <motion.button
            type="submit"
            disabled={!hasAnyInput || isLoading}
            whileHover={{ scale: hasAnyInput && !isLoading ? 1.02 : 1 }}
            whileTap={{ scale: hasAnyInput && !isLoading ? 0.98 : 1 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold",
              "bg-accent text-accent-foreground transition-opacity",
              (!hasAnyInput || isLoading) && "opacity-40 cursor-not-allowed",
            )}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Judging…
              </>
            ) : (
              <>
                <Gavel size={16} />
                Render verdict{bulk?.urls.length > 1 ? `s (${bulk.urls.length})` : ""}
              </>
            )}
          </motion.button>
        </div>

        {!bulk && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-xs text-muted-dim">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => fillExample(`https://github.com/${ex}`)}
                className="text-xs font-mono px-2 py-1 rounded-md bg-background-elevated border border-border text-muted hover:text-foreground hover:border-border-strong transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
