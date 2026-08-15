const ACCESS = "ansh_access";
const REFRESH = "ansh_refresh";

export function getAccess() {
  return localStorage.getItem(ACCESS);
}

export function getRefresh() {
  return localStorage.getItem(REFRESH);
}

export function setTokens(access, refresh) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

async function refreshTokens() {
  const refresh = getRefresh();
  if (!refresh) return false;
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getAccess();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  let res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    const ok = await refreshTokens();
    if (ok) {
      headers.Authorization = `Bearer ${getAccess()}`;
      res = await fetch(path, { ...options, headers });
    }
  }
  return res;
}

export function mediaUrl(path) {
  if (!path) return "";
  const token = getAccess();
  if (!token) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}access_token=${encodeURIComponent(token)}`;
}

export async function apiJson(path, options = {}) {
  const res = await api(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    const message = typeof detail === "string" ? detail : "Request failed";
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}
