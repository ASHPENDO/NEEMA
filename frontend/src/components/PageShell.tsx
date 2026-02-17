import React from "react";
import { motion } from "framer-motion";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6">
            <div className="text-xs font-semibold tracking-wide text-slate-500">POSTIKA</div>
            <h1 className="text-2xl font-semibold text-slate-900 mt-1">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-600 mt-2">{subtitle}</p> : null}
          </div>
          {children}
        </div>
        <div className="text-xs text-slate-500 mt-4 text-center">
          © {new Date().getFullYear()} POSTIKA
        </div>
      </motion.div>
    </div>
  );
}
