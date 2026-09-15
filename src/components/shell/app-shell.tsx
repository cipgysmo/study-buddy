"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh">
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Menu"
          className="rounded-lg p-2 text-foreground hover:bg-foreground/5"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="font-semibold tracking-tight">Study Buddy</span>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:static md:z-auto md:transform-none " +
          (open ? "translate-x-0" : "-translate-x-full md:translate-x-0")
        }
      >
        <Sidebar pathname={pathname} onNavigate={() => setOpen(false)} />
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-20 sm:px-10 md:pt-8">{children}</div>
      </main>
    </div>
  );
}
