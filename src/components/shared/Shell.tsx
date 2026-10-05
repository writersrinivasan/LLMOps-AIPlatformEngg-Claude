"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Cpu, Home, Presentation, Settings, Zap } from "lucide-react";
import { COLORS, MODULES, TOTAL_MINUTES } from "@/lib/curriculum";
import { useApp } from "@/lib/store";
import { cx, Toggle } from "@/components/ui";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { done, isLive, facilitator, setFacilitator } = useApp();
  const totalLabs = MODULES.reduce((a, m) => a + m.labs.length, 0);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <Link href="/" className="flex items-center gap-2 border-b border-slate-100 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
            <Cpu size={20} />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">LLMOps Lab</div>
            <div className="text-[11px] text-slate-500">AI Platform Engineering · {TOTAL_MINUTES / 60}h</div>
          </div>
        </Link>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3 text-sm">
          <NavLink href="/" active={path === "/"} icon={<Home size={15} />}>Session map</NavLink>
          <NavLink href="/facilitator" active={path === "/facilitator"} icon={<Presentation size={15} />}>Facilitator run sheet</NavLink>
          <div className="mt-4 mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Modules</div>
          {MODULES.map((m) => {
            const c = COLORS[m.color];
            const n = m.labs.filter((l) => done.has(l.id)).length;
            const active = path === `/${m.id}`;
            return (
              <Link key={m.id} href={`/${m.id}`} className={cx("mb-0.5 flex items-start gap-2 rounded-lg px-2 py-2 transition", active ? cx(c.soft, c.text) : "text-slate-700 hover:bg-slate-50")}>
                <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white", c.bg)}>{m.num}</span>
                <span className="flex-1 leading-tight">
                  <span className="block font-medium">{m.title.replace(/^(From |Building the |LLM )/, "")}</span>
                  <span className="text-[11px] text-slate-500">{m.minutes} min · {n}/{m.labs.length} labs</span>
                </span>
              </Link>
            );
          })}
          <div className="mt-4 mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Setup</div>
          <NavLink href="/settings" active={path === "/settings"} icon={<Settings size={15} />}>LLM settings</NavLink>
          <NavLink href="/glossary" active={path === "/glossary"} icon={<BookOpen size={15} />}>Glossary</NavLink>
        </nav>
        <div className="space-y-3 border-t border-slate-100 p-3">
          <div className="text-[11px] text-slate-500">
            Progress {done.size}/{totalLabs} labs
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(done.size / totalLabs) * 100}%` }} />
            </div>
          </div>
          <Link href="/settings" className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold", isLive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
            <Zap size={13} /> {isLive ? "LIVE: real LLM calls" : "SIMULATOR: offline mode"}
          </Link>
          <Toggle label="Facilitator mode" hint="Show talk track & answers" checked={facilitator} onChange={setFacilitator} />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx("mb-0.5 flex items-center gap-2 rounded-lg px-2 py-2", active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50")}>
      {icon}
      {children}
    </Link>
  );
}
