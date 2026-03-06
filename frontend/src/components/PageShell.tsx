// src/components/PageShell.tsx
import React from "react";
import { motion } from "framer-motion";

export function PageShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide text-slate-500">POSTIKA</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
          </div>

          {right ? <div className="shrink-0">{right}</div> : null}
        </div>

        {children}
      </div>
    </motion.div>
  );
}