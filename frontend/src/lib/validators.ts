export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeOtp(code: string) {
  return code.replace(/\s+/g, "").trim();
}
