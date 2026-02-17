import React from "react";

export function Input({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
      <input
        {...props}
        className={[
          "w-full rounded-xl border px-3 py-2 text-slate-900 placeholder:text-slate-400 outline-none",
          "focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300",
          error ? "border-red-300" : "border-slate-200",
        ].join(" ")}
      />
      {error ? <div className="text-xs text-red-600 mt-1">{error}</div> : null}
    </label>
  );
}
