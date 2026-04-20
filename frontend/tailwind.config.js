// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Layout & display
    "flex", "inline-flex", "hidden", "block", "grid",
    "min-h-screen", "w-full", "h-full",
    // Flexbox
    "items-center", "items-start", "justify-center", "justify-between",
    "flex-col", "flex-1", "flex-wrap", "shrink-0", "gap-2", "gap-3", "gap-4",
    // Spacing
    "px-4", "py-2", "px-6", "py-6", "p-3", "p-4", "p-6", "mt-1", "mb-4",
    "space-y-4", "space-y-6",
    // Typography
    "text-sm", "text-xs", "text-base", "text-xl", "text-2xl",
    "font-semibold", "font-bold", "font-medium",
    "text-white", "text-slate-900", "text-slate-600", "text-slate-500",
    "text-red-700", "text-green-700",
    // Backgrounds
    "bg-white", "bg-slate-50", "bg-slate-900", "bg-slate-700",
    "bg-red-50", "bg-green-50", "bg-amber-50",
    // Borders
    "border", "border-slate-200", "border-red-200", "border-green-200",
    "rounded-xl", "rounded-2xl", "rounded-lg", "rounded-full",
    // Shadow
    "shadow-sm",
    // Transitions
    "transition", "transition-all", "duration-200",
    // Animations
    "animate-spin",
    // Opacity
    "opacity-25", "opacity-75", "opacity-50",
    // Cursor
    "cursor-not-allowed", "cursor-pointer",
    // Focus
    "focus-visible:outline-none", "focus-visible:ring-2",
    // Disabled
    "disabled:opacity-50", "disabled:cursor-not-allowed",
    // Width
    "w-full", "w-4", "w-8", "max-w-xl", "max-w-5xl",
    // Height  
    "h-4", "h-8",
    // lg: responsive
    "lg:flex", "lg:px-8", "lg:py-8",
    // md: responsive
    "md:flex-row", "md:items-start", "md:col-span-2",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}