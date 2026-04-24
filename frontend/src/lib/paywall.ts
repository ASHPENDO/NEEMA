// Global paywall event bus (safe + deduplicated)

type Callback = () => void;

let listeners: Callback[] = [];

export function onPaywallOpen(cb: Callback) {
  // prevent duplicate listeners
  listeners = [...listeners, cb];
}

export function triggerPaywall() {
  listeners.forEach((cb) => cb());
}

export function clearPaywallListeners() {
  listeners = [];
}