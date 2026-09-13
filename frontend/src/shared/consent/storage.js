// Consent categories — extend here when new trackers are added.
export const CONSENT_VERSION = 1;
export const STORAGE_KEY = "coinfish.cookie-consent.v1";

export const CATEGORIES = [
  {
    id: "necessary",
    label: "Necessary",
    description: "Required for site functionality and security. Always on.",
    required: true,
  },
  {
    id: "performance",
    label: "Performance",
    description: "Helps us understand how the site performs so we can improve it.",
    required: false,
  },
  {
    id: "content",
    label: "Relevant content",
    description: "Helps us show content that is most relevant to you.",
    required: false,
  },
];

export function defaultPreferences() {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, Boolean(c.required)]));
}

export function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(preferences, { acceptedAll = false } = {}) {
  const payload = {
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
    acceptedAll,
    preferences: {
      ...defaultPreferences(),
      ...preferences,
      necessary: true,
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("coinfish:consent", { detail: payload }));
  return payload;
}

export function clearConsent() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("coinfish:consent", { detail: null }));
}

export function hasConsentChoice() {
  return readConsent() != null;
}

export function allows(categoryId) {
  const consent = readConsent();
  if (!consent) return categoryId === "necessary";
  return Boolean(consent.preferences?.[categoryId]);
}
