// src/components/PageShell.tsx
import React from "react";
import { motion } from "framer-motion";

export function PageShell({
  title,
  subtitle,
  right,
  workspaceName,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  workspaceName?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="relative z-0 w-full isolate"
    >
      <div className="relative z-10 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Page header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Postika
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
                {workspaceName && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {workspaceName}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              )}
            </div>
            {right && <div className="shrink-0">{right}</div>}
          </div>
        </div>

        {/* Page body */}
        <div className="relative z-10 px-6 py-6">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
