"use client";
import { useCallback, useRef, useState } from "react";
import { ShieldQuestion } from "lucide-react";
import { Btn } from "@/components/ui";

/** Human-in-the-loop approval: the agent awaits a promise that the facilitator/participant resolves. */
export function useApproval() {
  const [pending, setPending] = useState<{ tool: string; args: Record<string, unknown> } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const request = useCallback((tool: string, args: Record<string, unknown>) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setPending({ tool, args });
  }), []);

  const decide = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  const banner = pending ? (
    <div className="flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
      <ShieldQuestion className="mt-0.5 shrink-0 text-amber-600" size={20} />
      <div className="flex-1 text-sm">
        <div className="font-semibold text-amber-900">Approval required: the agent wants to call <code>{pending.tool}</code></div>
        <pre className="mt-1 whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px]">{JSON.stringify(pending.args, null, 2)}</pre>
      </div>
      <div className="flex flex-col gap-1">
        <Btn size="sm" variant="success" onClick={() => decide(true)}>Approve</Btn>
        <Btn size="sm" variant="danger" onClick={() => decide(false)}>Reject</Btn>
      </div>
    </div>
  ) : null;

  return { request, banner };
}
