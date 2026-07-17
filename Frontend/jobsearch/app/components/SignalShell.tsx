"use client";

import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs: { key: SignalTab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "applications", label: "Applications" },
    { key: "applied", label: "Applied" },
    { key: "saved", label: "Saved" },
    { key: "interview", label: "Interview Prep" },
  ];

  function handleTabChange(tab: SignalTab) {
    onTabChange(tab);
    setMenuOpen(false);
  }

  function handleLogout() {
    setMenuOpen(false);
    onLogout();
  }

  return (
    <div className="min-h-screen bg-[#f0f4ff] text-[#0a1428] font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-blue-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Logo />

            <div className="flex items-center gap-2">
              <nav className="hidden items-center gap-1 md:flex">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => onTabChange(tab.key)}
                      className={`cursor-pointer relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13.5px] font-bold transition duration-150 ${
                        isActive
                          ? "bg-[#e8f0ff] text-[#0052cc]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
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

              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[#0052cc] hover:text-[#0052cc] md:hidden"
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 md:inline-flex"
                aria-label="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          {menuOpen ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60 md:hidden">
              <nav className="flex flex-col gap-1">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTabChange(tab.key)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition ${
                        isActive
                          ? "bg-[#e8f0ff] text-[#0052cc]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.key === "saved" && savedCount > 0 && (
                        <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0052cc] px-1 text-[10px] font-extrabold text-white leading-none">
                          {savedCount > 99 ? "99+" : savedCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-slate-800"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
