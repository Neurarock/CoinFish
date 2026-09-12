// Auth/session context. Holds the logged-in account and token, and exposes the
// role so ThemeShell can pick the right palette. Demo-grade: token kept in memory
// + sessionStorage so a refresh doesn't drop you (no real security).
import { createContext, useContext, useEffect, useState } from "react";
import { api, setToken } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [token, setTok] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("cf_token");
    const acct = sessionStorage.getItem("cf_account");
    if (saved && acct) {
      setTok(saved);
      setToken(saved);
      setAccount(JSON.parse(acct));
    }
  }, []);

  function login(token, account) {
    setTok(token);
    setToken(token);
    setAccount(account);
    sessionStorage.setItem("cf_token", token);
    sessionStorage.setItem("cf_account", JSON.stringify(account));
  }

  function patchAccount(next) {
    setAccount(next);
    sessionStorage.setItem("cf_account", JSON.stringify(next));
  }

  function logout() {
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
