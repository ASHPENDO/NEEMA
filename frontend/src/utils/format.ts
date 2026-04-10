export const formatPrice = (amount?: number, currency?: string): string => {
  if (!amount) return "";
  const formatted = new Intl.NumberFormat().format(amount);
  return `${currency || "KES"} ${formatted}`;
};

export const formatPricePsychology = (
  amount?: number,
  currency?: string,
  mode: "normal" | "starting" | "only" | "deal" = "normal"
): string => {
  const base = formatPrice(amount, currency);
  if (!base) return "";
  switch (mode) {
    case "starting": return `Starting from ${base}`;
    case "only":     return `Only ${base}`;
    case "deal":     return `Now ${base}`;
    default:         return base;
  }
};