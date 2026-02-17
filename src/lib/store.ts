export interface SourceOption {
  id: number;
  key: string;
  label: string;
  icon: string;
  sort_order: number;
  active: boolean;
}

export interface Restaurant {
  id: number;
  name: string;
  slug?: string;
  has_password?: boolean;
}

export interface ResponseRecord {
  id: number;
  restaurant_id: number;
  source: string;
  created_at: string;
}

export interface AppSettings {
  telegram_chat_id: string;
  telegram_notifications_enabled: boolean;
}

let backendUrls: Record<string, string> = {};

export async function loadUrls() {
  if (Object.keys(backendUrls).length > 0) return backendUrls;
  try {
    const res = await fetch("/func2url.json");
    backendUrls = await res.json();
  } catch {
    backendUrls = {};
  }
  return backendUrls;
}

export async function apiCall(funcName: string, options: RequestInit = {}) {
  const urls = await loadUrls();
  const url = urls[funcName];
  if (!url) throw new Error(`Function ${funcName} not found`);

  const token = localStorage.getItem("sweep_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const sourceLabel = (key: string, sources: SourceOption[]) => {
  const found = sources.find((s) => s.key === key);
  return found?.label || key;
};

export default { loadUrls, apiCall, sourceLabel };