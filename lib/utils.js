import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function scoreBand(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "mid";
  return "low";
}

export function cleanModelName(id) {
  if (!id) return "";
  return id.replace(/:free$/i, "");
}

export function scoreLabel(score) {
  if (score >= 90) return "Exceptional";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 45) return "Needs Work";
  if (score >= 25) return "Early Prototype";
  return "Rough Draft";
}
