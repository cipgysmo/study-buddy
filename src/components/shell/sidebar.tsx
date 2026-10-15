"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { JobsIndicator } from "./jobs-indicator";
import { useActiveJobs } from "./jobs-provider";
import { LlmStatus } from "./llm-status";
import { NavIcon } from "./nav-icons";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  href: string;
  labelKey: string;
  activePaths?: string[];
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "sectionStudy",
    items: [
      { href: "/", labelKey: "dashboard" },
      { href: "/chat", labelKey: "chat" },
      { href: "/lessons", labelKey: "lessons" },
      { href: "/subjects", labelKey: "subjects" },
      { href: "/exam-prep", labelKey: "examPrep" },
    ],
  },
  {
    labelKey: "sectionPractice",
    items: [
      {
        href: "/activities",
        labelKey: "activities",
        activePaths: ["/activities", "/quizzes", "/exercises", "/mock-exams"],
      },
      { href: "/flashcards", labelKey: "flashcards" },
      { href: "/arena", labelKey: "arena" },
    ],
  },
  {
    labelKey: "sectionProgress",
    items: [
      { href: "/progress", labelKey: "progress" },
      { href: "/rewards", labelKey: "rewards" },
      { href: "/reports", labelKey: "reports" },
      { href: "/history", labelKey: "history" },
    ],
  },
  {
    labelKey: "sectionTools",
    items: [{ href: "/scan", labelKey: "scan" }],
  },
  {
    labelKey: "sectionManage",
    items: [
      { href: "/requests", labelKey: "requests" },
      { href: "/admin", labelKey: "admin" },
      { href: "/settings", labelKey: "settings" },
    ],
  },
];

export function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");
  const activeJobs = useActiveJobs();

  const isActive = (item: NavItem) => {
    const paths = item.activePaths ?? [item.href];
    return paths.some((href) =>
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
    );
  };

  return (
    <aside className="h-full w-60 shrink-0 border-e border-border bg-card/70 backdrop-blur">
      <div className="flex h-full flex-col">
        <div className="px-5 py-5">
          <span className="text-lg font-semibold tracking-tight">Study Buddy</span>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.labelKey}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                {t(section.labelKey)}
              </div>
              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={
                        "flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition " +
                        (active
                          ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                          : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground")
                      }
                    >
                      <NavIcon name={item.labelKey} className="h-[18px] w-[18px]" />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        {activeJobs.length > 0 && (
          <div className="px-4 pb-1">
            <JobsIndicator />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <LlmStatus />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
