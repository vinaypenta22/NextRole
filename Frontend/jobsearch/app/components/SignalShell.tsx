"use client";

import { useState } from "react";
import { LogOut, Menu, X, Settings, Bell, Mail } from "lucide-react";
import Link from "next/link";
import Logo from "./Logo";
import { useTheme, AccentColor, ThemeLayout, ThemeMode } from "../lib/theme";

type SignalTab = "profile" | "applications" | "applied" | "saved" | "interview";

type SignalShellProps = {
  activeTab: SignalTab;
  onTabChange: (tab: SignalTab) => void;
  onLogout: () => void;
  savedCount?: number;
  userName?: string;
  initials?: string;
  children: React.ReactNode;
};

const ACCENT_OPTIONS: { key: AccentColor; label: string; color: string }[] = [
  { key: "amber",   label: "Warm Amber",    color: "#f59e0b" },
  { key: "blue",    label: "Classic Blue",  color: "#2563eb" },
  { key: "emerald", label: "Forest Emerald",color: "#16a34a" },
  { key: "indigo",  label: "Elegant Indigo",color: "#6366f1" },
  { key: "rose",    label: "Velvet Rose",   color: "#e11d48" },
];

export default function SignalShell({
  activeTab,
  onTabChange,
  onLogout,
  savedCount = 0,
  initials = "VP",
  children,
}: SignalShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, layout, accent, setMode, setLayout, setAccent } = useTheme();

  // Keep track of original settings on open to revert if canceled
  const [origMode, setOrigMode] = useState<ThemeMode>(mode);
  const [origLayout, setOrigLayout] = useState<ThemeLayout>(layout);
  const [origAccent, setOrigAccent] = useState<AccentColor>(accent);

  function openSettings() {
    setOrigMode(mode);
    setOrigLayout(layout);
    setOrigAccent(accent);
    setSettingsOpen(true);
  }

  function handleCancel() {
    setMode(origMode);
    setLayout(origLayout);
    setAccent(origAccent);
    setSettingsOpen(false);
  }

  function applySettings() {
    // Changes were applied live, so just close the modal
    setSettingsOpen(false);
  }

  const tabs: { key: SignalTab; label: string }[] = [
    { key: "profile",      label: "Profile" },
    { key: "applications", label: "Find Jobs" },
    { key: "applied",      label: "Applied" },
    { key: "saved",        label: "Saved" },
    { key: "interview",    label: "Interview Prep" },
  ];

  function handleTabChange(tab: SignalTab) {
    onTabChange(tab);
    setMenuOpen(false);
  }

  return (
    <div
      className="min-h-screen text-[var(--fg)] font-sans flex flex-col justify-start bg-transparent"
    >
      <div className="mx-auto w-full rounded-[32px] border shadow-xs transition-all duration-300 hover:shadow-lg flex flex-col bg-gradient-to-br from-slate-50 via-slate-100/40 to-slate-200/20 dark:from-zinc-950/45 dark:via-zinc-900/45 dark:to-slate-950/45" style={{ maxWidth: "1440px", margin: "20px auto", width: "calc(100% - 32px)", borderColor: "var(--surface-border)" }}>
        {/* ══ HEADER ══ */}
        <header
          className="w-full"
          style={{ background: "transparent" }}
        >
          <div className="w-full" style={{paddingLeft:"20px",paddingRight:"20px"}}>
            <div className="flex items-center justify-between gap-3">

              {/* Logo */}
              <Logo />

              {/* Center Nav Tabs (desktop) */}
              <nav className="hidden items-center gap-1 md:flex">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => onTabChange(tab.key)}
                      className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4.5 py-2 text-[13px] font-bold transition duration-150 ${
                        isActive
                          ? "text-[var(--tab-active-fg)] shadow-sm"
                          : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                      }`}
                      style={isActive ? { background: "var(--tab-active-bg)" } : {}}
                    >
                      {tab.label}
                      {tab.key === "saved" && savedCount > 0 && (
                        <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[9px] font-black text-white leading-none">
                          {savedCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Right: icons */}
              <div className="flex items-center gap-2.5">
                {/* Settings */}
                <button
                  type="button"
                  onClick={openSettings}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-[var(--surface-hover)] cursor-pointer"
                  aria-label="Settings"
                  style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--fg-muted)" }}
                >
                  <Settings size={15} />
                </button>

                {/* Logout */}
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[var(--surface-hover)] cursor-pointer"
                  aria-label="Logout"
                  style={{ background: "var(--surface)", borderColor: "var(--surface-border)", color: "var(--fg-muted)" }}
                >
                  <LogOut size={16} />
                </button>

                {/* Mobile hamburger */}
                <button
                  type="button"
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition md:hidden"
                  style={{ borderColor: "var(--surface-border)", color: "var(--fg-muted)", background: "var(--surface)" }}
                >
                  {menuOpen ? <X size={17} /> : <Menu size={17} />}
                </button>
              </div>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
              <div
                className="mt-3 rounded-2xl border p-2 md:hidden"
                style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}
              >
                <nav className="flex flex-col gap-1">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleTabChange(tab.key)}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition ${
                          isActive
                            ? "text-[var(--tab-active-fg)]"
                            : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                        }`}
                        style={isActive ? { background: "var(--tab-active-bg)" } : {}}
                      >
                        <span>{tab.label}</span>
                        {tab.key === "saved" && savedCount > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                            {savedCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-2 flex gap-2 px-1">
                  <button
                    type="button"
                    onClick={openSettings}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition hover:bg-[var(--surface-hover)]"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    <Settings size={14} /> Settings
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white transition"
                    style={{ background: "var(--tab-active-bg)" }}
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ══ MAIN CONTENT ══ */}
        <main className="w-full px-8 sm:px-12 pb-8 sm:pb-12 pt-4">
          {children}
        </main>
      </div>

      {/* ══ SETTINGS MODAL ══ */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
        >
          <div
            className="relative w-full max-w-[520px] rounded-3xl p-7 shadow-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
          >
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: "var(--accent)" }}
                >
                  <Settings size={18} />
                </span>
                <div>
                  <h2 className="text-[17px] font-extrabold" style={{ color: "var(--fg)" }}>Settings</h2>
                  <p className="text-[12px]" style={{ color: "var(--fg-muted)" }}>Customize your workspace experience</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--fg-muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Section: Aesthetics */}
            <p className="mb-3 text-[12px] font-bold" style={{ color: "var(--fg)" }}>Aesthetics &amp; Contrast</p>
            <div className="mb-5 grid grid-cols-2 gap-2">
              {(["light", "dark"] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] font-semibold transition"
                  style={{
                    borderColor: mode === m ? "var(--accent)" : "var(--surface-border)",
                    background: mode === m ? "var(--accent-soft)" : "var(--surface)",
                    color: mode === m ? "var(--accent)" : "var(--fg-muted)",
                  }}
                >
                  {m === "light" ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                  {m === "light" ? "Light Mode" : "Dark Mode"}
                </button>
              ))}
            </div>

            {/* Section: Layout */}
            <p className="mb-3 text-[12px] font-bold" style={{ color: "var(--fg)" }}>Workspace Theme Layout</p>
            <div className="mb-2 grid grid-cols-2 gap-2">
              {(["normal", "glass"] as ThemeLayout[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayout(l)}
                  className="flex items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] font-semibold transition"
                  style={{
                    borderColor: layout === l ? "var(--accent)" : "var(--surface-border)",
                    background: layout === l ? "var(--accent-soft)" : "var(--surface)",
                    color: layout === l ? "var(--accent)" : "var(--fg-muted)",
                  }}
                >
                  {l === "normal" ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3c-4.5 0-8 3.5-8 8s3.5 8 8 8 8-3.5 8-8-3.5-8-8-8z" opacity=".4" /><path d="M12 7c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z" />
                    </svg>
                  )}
                  {l === "normal" ? "Normal Design" : "Glassmorphism"}
                </button>
              ))}
            </div>
            <p className="mb-5 text-[11px] leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
              Glassmorphism enables frosted-translucent panels, fluid ambient backgrounds, and refined depth.
            </p>

            {/* Done button */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={applySettings}
                className="rounded-full px-7 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90 cursor-pointer"
                style={{ background: "var(--accent)" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
