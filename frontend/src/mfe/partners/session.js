const KEY = "coinfish_partner_demo";
const ENROLL_KEY = "coinfish_partner_enrolled";

export function isPartnerAuthed() {
  try {
    return Boolean(sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function setPartnerSession(payload) {
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearPartnerSession() {
  sessionStorage.removeItem(KEY);
}

export function getPartnerSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function enrolledEmails() {
  try {
    const raw = localStorage.getItem(ENROLL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function isPartnerEnrolled(email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle) return false;
  return enrolledEmails().some((item) => String(item).trim().toLowerCase() === needle);
}

export function enrollPartner(email) {
  const value = String(email || "").trim();
  if (!value) return;
  if (isPartnerEnrolled(value)) return;
  localStorage.setItem(ENROLL_KEY, JSON.stringify([...enrolledEmails(), value]));
}
