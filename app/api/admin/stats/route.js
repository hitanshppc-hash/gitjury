import { NextResponse } from "next/server";
import { getAllVerdicts } from "@/lib/db";
import { TRACKS, VERDICT_TAGS } from "@/lib/rubric";

const BUCKETS = [
  { label: "0-20", min: 0, max: 20 },
  { label: "21-40", min: 21, max: 40 },
  { label: "41-60", min: 41, max: 60 },
  { label: "61-80", min: 61, max: 80 },
  { label: "81-100", min: 81, max: 100 },
];

function summarize(entries) {
  const total = entries.length;
  const avgScore = total ? Math.round(entries.reduce((s, e) => s + e.verdict.overallScore, 0) / total) : 0;

  const scoreDistribution = BUCKETS.map((b) => ({
    label: b.label,
    count: entries.filter((e) => e.verdict.overallScore >= b.min && e.verdict.overallScore <= b.max).length,
  }));

  const verdictTagBreakdown = VERDICT_TAGS.map((tag) => ({
    tag,
    count: entries.filter((e) => e.verdict.verdictTag === tag).length,
  }));

  const trackBreakdown = TRACKS.map((track) => {
    const inTrack = entries.filter((e) => (e.verdict.track || "Other") === track);
    return {
      track,
      count: inTrack.length,
      avgScore: inTrack.length ? Math.round(inTrack.reduce((s, e) => s + e.verdict.overallScore, 0) / inTrack.length) : 0,
    };
  }).filter((t) => t.count > 0);

  const categoryAverages = total
    ? Object.keys(entries[0]?.verdict.categories || {}).map((key) => {
        const vals = entries.map((e) => e.verdict.categories[key]?.score || 0);
        const max = entries[0].verdict.categories[key]?.max || 0;
        return {
          key,
          label: entries[0].verdict.categories[key]?.label || key,
          max,
          avg: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
        };
      })
    : [];

  const bySlugSorted = [...entries].sort((a, b) => b.verdict.overallScore - a.verdict.overallScore);
  const pick = (arr, n) =>
    arr.slice(0, n).map((e) => ({
      slug: e.slug,
      url: e.url,
      score: e.verdict.overallScore,
      verdictTag: e.verdict.verdictTag,
      track: e.verdict.track,
      summary: e.verdict.summary,
      topReason:
        Object.values(e.verdict.categories).sort((a, b) => b.score / b.max - a.score / a.max)[0]?.justification || "",
      weakestReason:
        Object.values(e.verdict.categories).sort((a, b) => a.score / a.max - b.score / b.max)[0]?.justification || "",
    }));

  const topBest = pick(bySlugSorted, 5);
  const topWorst = pick([...bySlugSorted].reverse(), 5);

  const medianIdx = Math.floor(bySlugSorted.length / 2);
  const median = bySlugSorted.length ? pick(bySlugSorted.slice(medianIdx, medianIdx + 3), 3) : [];

  const recent = [...entries]
    .sort((a, b) => new Date(b.transparency?.judgedAt || 0) - new Date(a.transparency?.judgedAt || 0))
    .slice(0, 20)
    .map((e) => ({
      slug: e.slug,
      score: e.verdict.overallScore,
      verdictTag: e.verdict.verdictTag,
      track: e.verdict.track,
      judgedAt: e.transparency?.judgedAt,
      fromCache: Boolean(e.fromCache),
    }));

  return {
    total,
    avgScore,
    scoreDistribution,
    verdictTagBreakdown,
    trackBreakdown,
    categoryAverages,
    topBest,
    topWorst,
    median,
    recent,
  };
}

export async function GET() {
  const all = await getAllVerdicts();
  const entries = all.filter((e) => e.ok && e.verdict);
  return NextResponse.json(summarize(entries));
}
