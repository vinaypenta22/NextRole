"use client";

import Logo from "./Logo";

type SignalTab = "profile" | "applications" | "applied" | "interview";

type SignalShellProps = {
  activeTab: SignalTab;
  onTabChange: (tab: SignalTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export default function SignalShell({
  activeTab,
  onTabChange,
  onLogout,
  children,
}: SignalShellProps) {
  return (
    <div className="min-h-screen bg-[#f0f4ff] text-[#0a1428] font-sans">
      {/* Header bar */}
      <header className="sticky top-0 z-40 w-full border-b border-blue-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo on the left */}
          <Logo />

          {/* Navigation links & actions on the right */}
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onTabChange("profile")}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-bold transition duration-150 ${
                  activeTab === "profile"
                    ? "bg-[#e8f0ff] text-[#0052cc]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => onTabChange("applications")}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-bold transition duration-150 ${
                  activeTab === "applications"
                    ? "bg-[#e8f0ff] text-[#0052cc]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Applications
              </button>
              <button
                type="button"
                onClick={() => onTabChange("applied")}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-bold transition duration-150 ${
                  activeTab === "applied"
                    ? "bg-[#e8f0ff] text-[#0052cc]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Applied
              </button>
              <button
                type="button"
                onClick={() => onTabChange("interview")}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-bold transition duration-150 ${
                  activeTab === "interview"
                    ? "bg-[#e8f0ff] text-[#0052cc]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Interview Preparation
              </button>
            </nav>

            <div className="h-5 w-px bg-slate-200"></div>

            {/* Icons */}
            <div className="flex items-center gap-3">
              {/* Settings icon */}
              {/* <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Settings"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button> */}

              {/* Logout icon */}
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
        </div>
      </header>

      {/* Main page content wrapped in standard spacing container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
