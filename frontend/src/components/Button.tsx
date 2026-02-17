import React from "react";

export function Button({
  loading,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "secondary" }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "bg-slate-100 text-slate-900 hover:bg-slate-200";

  return (
    <button {...props} className={[base, styles, props.className ?? ""].join(" ")} disabled={props.disabled || loading}>
      {loading ? "Please wait…" : props.children}
    </button>
  );
}
