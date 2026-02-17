export const SOURCES = [
  { id: "instagram", label: "Instagram / соцсети", icon: "Instagram" },
  { id: "friends", label: "Рекомендация друзей", icon: "Users" },
  { id: "internet_ads", label: "Реклама в интернете", icon: "Globe" },
  { id: "banner", label: "Баннер / вывеска", icon: "Signpost" },
  { id: "passerby", label: "Проходил(а) мимо", icon: "Footprints" },
  { id: "other", label: "Другое", icon: "MessageCircle" },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export interface Restaurant {
  id: number;
  name: string;
}

export interface ResponseRecord {
  id: number;
  restaurant_id: number;
  source: string;
  created_at: string;
}

export interface StatsData {
  total: number;
  by_source: Record<string, number>;
  by_date: { date: string; count: number }[];
  restaurants: Restaurant[];
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

export default { SOURCES, loadUrls, apiCall };
