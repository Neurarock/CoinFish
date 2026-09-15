// Auth/session context. Holds the logged-in account and token, and exposes the
// role so ThemeShell can pick the right palette. Demo-grade: token kept in memory
// + sessionStorage so a refresh doesn't drop you (no real security).
import { createContext, useCallback, useContext, useState } from "react";
import { api, setToken } from "./api.js";

const AuthCtx = createContext(null);

function readSavedSession() {
  try {
    const saved = sessionStorage.getItem("cf_token");
    const acct = sessionStorage.getItem("cf_account");
    if (saved && acct) {
      setToken(saved);
      return { token: saved, account: JSON.parse(acct) };
    }
  } catch {
    return { token: null, account: null };
  }
  return { token: null, account: null };
}

export function AuthProvider({ children }) {
  const [saved] = useState(readSavedSession);
  const [account, setAccount] = useState(saved.account);
  const [token, setTok] = useState(saved.token);

  function login(token, account) {
    setTok(token);
    setToken(token);
    setAccount(account);
    sessionStorage.setItem("cf_token", token);
    sessionStorage.setItem("cf_account", JSON.stringify(account));
  }

  const patchAccount = useCallback((next) => {
    setAccount(next);
    sessionStorage.setItem("cf_account", JSON.stringify(next));
  }, []);

  function logout() {
    import("./neonAuth.js").then((m) => m.neonSignOut()).catch(() => {});
    setTok(null);
    setToken(null);
    setAccount(null);
    sessionStorage.clear();
  }

  return (
    <AuthCtx.Provider value={{ account, token, login, logout, patchAccount, api }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
