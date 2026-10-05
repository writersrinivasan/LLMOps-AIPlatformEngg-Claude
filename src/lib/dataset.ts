"use client";
import { useCallback, useEffect, useState } from "react";
import { GOLDEN, TestCase } from "./eval";

const KEY = "llmops.dataset";
const EVENT = "llmops-dataset";

/** Golden dataset shared between lab 4.4 (builder) and 4.5 (pipeline), persisted per browser. */
export function useDataset(): [TestCase[], (c: TestCase[]) => void] {
  const [cases, setCases] = useState<TestCase[]>(GOLDEN);
  useEffect(() => {
    const load = () => {
      try {
        const v = localStorage.getItem(KEY);
        if (v) setCases(JSON.parse(v));
      } catch { /* ignore */ }
    };
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, []);
  const save = useCallback((c: TestCase[]) => {
    setCases(c);
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [cases, save];
}
