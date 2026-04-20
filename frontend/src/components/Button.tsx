// src/components/Button.tsx
import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: ButtonVariant;
}

// Inline style fallbacks — ensure visibility even if Tailwind purges the class
const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { backgroundColor: "#0f172a", color: "#ffffff", borderColor: "transparent" },
  secondary: { backgroundColor: "#ffffff", color: "#374151", borderColor: "#e2e8f0" },
  danger:    { backgroundColor: "#ffffff", color: "#dc2626", borderColor: "#fecaca" },
};

export function Button({
  children,
  loading = false,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
  style,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "bg-slate-900 text-white border border-transparent hover:bg-slate-700 focus-visible:ring-slate-900 shadow-sm"
      : variant === "danger"
      ? "bg-white text-red-600 border border-red-200 hover:bg-red-50 focus-visible:ring-red-400 shadow-sm"
      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-400 shadow-sm";

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      className={[
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        variantClass,
        className,
      ].join(" ").trim()}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg"
            fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Please wait...
        </span>
      ) : (
        children
      )}
    </button>
  );
}