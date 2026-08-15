import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiJson, clearTokens, getAccess, getRefresh, setTokens } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    if (!getAccess() && !getRefresh()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiJson("/api/users/me");
      setUser(me);
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email, password) {
    const data = await apiJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setTokens(data.access_token, data.refresh_token);
    await loadMe();
  }

  async function signup(email, password) {
    await apiJson("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await login(email, password);
  }

  async function logout() {
    const refresh = getRefresh();
    try {
      if (refresh) {
        await apiJson("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        });
      }
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, setUser, loading, login, signup, logout, reload: loadMe }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
