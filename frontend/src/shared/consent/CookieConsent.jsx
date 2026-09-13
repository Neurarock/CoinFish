// Site-wide cookie consent — banner + preferences drawer.
import { useEffect, useState } from "react";
import {
  CATEGORIES,
  defaultPreferences,
  hasConsentChoice,
  readConsent,
  writeConsent,
} from "./storage.js";
import "./consent.css";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [prefs, setPrefs] = useState(defaultPreferences);

  useEffect(() => {
    if (!hasConsentChoice()) setVisible(true);

    const onOpen = () => {
      const existing = readConsent()?.preferences || defaultPreferences();
      setPrefs({ ...defaultPreferences(), ...existing, necessary: true });
      setManaging(true);
      setVisible(true);
    };
    window.addEventListener("coinfish:open-cookie-settings", onOpen);
    return () => window.removeEventListener("coinfish:open-cookie-settings", onOpen);
  }, []);

  function acceptAll() {
    const next = Object.fromEntries(CATEGORIES.map((c) => [c.id, true]));
    writeConsent(next, { acceptedAll: true });
    setVisible(false);
    setManaging(false);
  }

  function savePreferences() {
    writeConsent(prefs, { acceptedAll: false });
    setVisible(false);
    setManaging(false);
  }

  function rejectOptional() {
    writeConsent(defaultPreferences(), { acceptedAll: false });
    setVisible(false);
    setManaging(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title" aria-modal="false">
      <div className="cookie-consent-panel">
        <h2 id="cookie-consent-title" className="cookie-consent-title">
          Your privacy is important to us
        </h2>
        <p className="cookie-consent-copy">
          Our site uses cookies for reasons including site functionality, understanding
          performance so we can improve our offering, and helping us to show content that is
          most relevant to you. We won&apos;t set any non-functional cookies unless you give us
          your permission. See our{" "}
          <a href="#pending-cookies" className="cookie-consent-link">
            cookie notice
          </a>
          .
        </p>

        {managing && (
          <div className="cookie-consent-prefs" role="group" aria-label="Cookie categories">
            {CATEGORIES.map((cat) => (
              <label key={cat.id} className="cookie-consent-pref">
                <span className="cookie-consent-pref-text">
                  <span className="cookie-consent-pref-label">{cat.label}</span>
                  <span className="cookie-consent-pref-desc">{cat.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(prefs[cat.id])}
                  disabled={cat.required}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, [cat.id]: e.target.checked }))
                  }
                />
              </label>
            ))}
          </div>
        )}

        <div className="cookie-consent-actions">
          {managing ? (
            <>
              <button type="button" className="cookie-consent-btn ghost" onClick={rejectOptional}>
                Necessary only
              </button>
              <button type="button" className="cookie-consent-btn primary" onClick={savePreferences}>
                Save preferences
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cookie-consent-btn ghost"
                onClick={() => setManaging(true)}
              >
                Manage cookies
              </button>
              <button type="button" className="cookie-consent-btn primary" onClick={acceptAll}>
                Accept all cookies
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Open the preference panel from footer “Cookies Policy” / settings links. */
export function openCookieSettings() {
  window.dispatchEvent(new Event("coinfish:open-cookie-settings"));
}
