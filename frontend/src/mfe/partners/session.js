const KEY = "coinfish_partner_demo";

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
