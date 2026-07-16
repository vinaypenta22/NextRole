"use client";

import { Bookmark } from "lucide-react";
import Logo from "./Logo";

type SignalTab = "profile" | "applications" | "applied" | "saved" | "interview";

type SignalShellProps = {
  activeTab: SignalTab;
  onTabChange: (tab: SignalTab) => void;
  onLogout: () => void;
  savedCount?: number;
  children: React.ReactNode;
};

export default function SignalShell({
  activeTab,
  onTabChange,
  onLogout,
  savedCount = 0,
  children,
}: SignalShellProps) {
  const tabs: { key: SignalTab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "applications", label: "Applications" },
    { key: "applied", label: "Applied" },
    { key: "saved", label: "Saved" },
    { key: "interview", label: "Interview Prep" },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4ff] text-[#0a1428] font-sans">
      {/* Header bar */}
      <header className="sticky top-0 z-40 w-full border-b border-blue-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />

          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13.5px] font-bold transition duration-150 ${
                      isActive
                        ? "bg-[#e8f0ff] text-[#0052cc]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {/* {tab.key === "saved" && (
                      <Bookmark size={13} className={isActive ? "text-[#0052cc]" : "text-slate-400"} />
                    )} */}
                    {tab.label}
                    {tab.key === "saved" && savedCount > 0 && (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0052cc] px-1 text-[10px] font-extrabold text-white leading-none">
                        {savedCount > 99 ? "99+" : savedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="h-5 w-px bg-slate-200" />

            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Logout"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
