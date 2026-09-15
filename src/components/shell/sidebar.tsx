"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  labelKey: string;
}

const NAV: NavItem[] = [
  { href: "/", labelKey: "dashboard" },
  { href: "/chat", labelKey: "chat" },
  { href: "/subjects", labelKey: "subjects" },
  { href: "/exam-prep", labelKey: "examPrep" },
  { href: "/flashcards", labelKey: "flashcards" },
  { href: "/quizzes", labelKey: "quizzes" },
  { href: "/exercises", labelKey: "exercises" },
  { href: "/mock-exams", labelKey: "mockExams" },
  { href: "/scan", labelKey: "scan" },
  { href: "/podcasts", labelKey: "podcasts" },
  { href: "/progress", labelKey: "progress" },
  { href: "/settings", labelKey: "settings" },
];

export function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="h-full w-60 shrink-0 border-e border-border bg-card/60 backdrop-blur">
      <div className="flex h-full flex-col">
        <div className="px-5 py-5">
          <span className="text-lg font-semibold tracking-tight">Study Buddy</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/80 hover:bg-foreground/5")
                }
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
