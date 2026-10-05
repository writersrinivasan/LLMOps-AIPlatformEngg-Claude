"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface LlmSettings {
  live: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  judgeModel: string;
}

interface AppState {
  settings: LlmSettings;
  setSettings: (s: LlmSettings) => void;
  serverConfigured: boolean;
  isLive: boolean;
  facilitator: boolean;
  setFacilitator: (v: boolean) => void;
  done: Set<string>;
  toggleDone: (labId: string) => void;
  team: string;
  setTeam: (t: string) => void;
}

const DEFAULT: LlmSettings = { live: false, baseUrl: "https://api.openai.com/v1", apiKey: "", model: "", judgeModel: "" };

const Ctx = createContext<AppState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<LlmSettings>(DEFAULT);
  const [facilitator, setFacState] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [team, setTeamState] = useState("");
  const [serverConfigured, setServerConfigured] = useState(false);

  useEffect(() => {
    // hydrate persisted state after mount to avoid SSR mismatch
    /* eslint-disable react-hooks/set-state-in-effect */
    setSettingsState({ ...DEFAULT, ...load("llmops.settings", {}) });
    setFacState(load("llmops.facilitator", false));
    setDone(new Set(load<string[]>("llmops.done", [])));
    setTeamState(load("llmops.team", ""));
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch("/api/llm").then((r) => r.json()).then((d) => setServerConfigured(Boolean(d.configured))).catch(() => {});
  }, []);

  const setSettings = useCallback((s: LlmSettings) => { setSettingsState(s); save("llmops.settings", s); }, []);
  const setFacilitator = useCallback((v: boolean) => { setFacState(v); save("llmops.facilitator", v); }, []);
  const setTeam = useCallback((t: string) => { setTeamState(t); save("llmops.team", t); }, []);
  const toggleDone = useCallback((id: string) => {
    setDone((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      save("llmops.done", [...n]);
      return n;
    });
  }, []);

  const isLive = settings.live && (Boolean(settings.model && settings.baseUrl) || serverConfigured);

  const value = useMemo(
    () => ({ settings, setSettings, serverConfigured, isLive, facilitator, setFacilitator, done, toggleDone, team, setTeam }),
    [settings, setSettings, serverConfigured, isLive, facilitator, setFacilitator, done, toggleDone, team, setTeam],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}
