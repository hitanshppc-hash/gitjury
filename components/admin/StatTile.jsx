"use client";

import { motion } from "framer-motion";

export default function StatTile({ label, value, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="gj-card p-4"
    >
      <p className="text-xs text-muted-dim">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </motion.div>
  );
}
