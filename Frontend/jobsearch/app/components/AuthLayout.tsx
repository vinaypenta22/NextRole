"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "../lib/theme";
import Logo from "./Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname?.includes("login");
  const { mode, setMode } = useTheme();

  const features = [
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
      title: "ATS Analysis",
      text: "Instant score, recommendations, and skill fixes.",
      color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/45",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
        </svg>
      ),
      title: "Interview Prep",
      text: "Custom tech questions matching your exact stack.",
      color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/45",
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" />
        </svg>
      ),
      title: "Smart Match",
      text: "Direct matching cards with accurate score ratings.",
      color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/45",
    },
  ];

  const avatars = [
    { label: "V", bg: "#0f172a" },
    { label: "A", bg: "#7c3aed" },
    { label: "R", bg: "#f59e0b" },
    { label: "S", bg: "#16a34a" },
  ];

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-[var(--fg)] transition-colors duration-300"
      style={{
        background: mode === "dark"
          ? "linear-gradient(135deg, #09090b 0%, #111118 50%, #181324 100%)"
          : "linear-gradient(135deg, #ebdcd4 0%, #dbe2ea 50%, #eae3ef 100%)",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        backgroundSize: "cover"
      }}
    >
      {/* Subtle ambient blobs */}
      <div className={`absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-300 ${mode === "dark" ? "opacity-25" : "opacity-100"}`}>
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-[-4rem] h-[440px] w-[440px] rounded-full bg-emerald-100/25 blur-3xl" />
        {mode === "dark" && (
          <div className="absolute right-[15%] bottom-[10%] h-[380px] w-[380px] rounded-full bg-indigo-500/10 blur-3xl" />
        )}
        <div className="absolute bottom-[-6rem] left-[25%] h-64 w-64 rounded-full bg-orange-100/20 blur-3xl" />
      </div>



      {/* Main layout */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">

          {/* ── LEFT: Hero ── */}
          <div className="hidden flex-col justify-center space-y-8 lg:flex">


            

            {/* Main headline */}
            <div className="space-y-3">
              <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]" style={{ color: "var(--fg)" }}>
                A <span style={{ color: "var(--accent)" }}>warmer, sharper</span>{"\n"}
                <br />job search experience.
              </h1>
              <p className="max-w-md text-[15px] leading-7" style={{ color: "var(--fg-muted)" }}>
                Analyze your resume instantly against ATS standards, access tailormade interview preparation, and discover matched positions in a calm, beautifully organized workspace.
              </p>
            </div>

            {/* Feature cards */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              {features.map((feat) => (
                <div
                  key={feat.title}
                  className="rounded-2xl border p-4 shadow-sm backdrop-blur-sm transition duration-300 hover:scale-[1.02] hover:shadow-md"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--surface-border)",
                  }}
                >
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${feat.color} mb-3`}>
                    {feat.icon}
                  </span>
                  <h3 className="text-[13.5px] font-extrabold" style={{ color: "var(--fg)" }}>{feat.title}</h3>
                  <p className="mt-1 text-[12px] leading-5" style={{ color: "var(--fg-muted)" }}>{feat.text}</p>
                </div>
              ))}
            </div>

            {/* Rating row */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2.5">
                {avatars.map((av, i) => (
                  <span
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-black text-white ring-2 ring-white"
                    style={{ backgroundColor: av.bg }}
                  >
                    {av.label}
                  </span>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[#f59e0b]"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                  <span className="ml-1 text-[12px] font-extrabold" style={{ color: "var(--fg)" }}>4.8/5 Rating</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-subtle)" }}>Trusted by modern professionals seeking impact.</p>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Auth card ── */}
          <div className="flex flex-col items-center justify-center">


            <div
              className="w-full max-w-[440px] rounded-3xl border p-7 shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition-all duration-200"
              style={{
                background: "var(--surface)",
                borderColor: "var(--surface-border)",
              }}
            >
              {/* Sign In / Sign Up toggle */}
              {/* <div
                className="mb-6 flex rounded-xl border p-1"
                style={{
                  background: "var(--bg)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <Link
                  href="/login"
                  className="flex-1 rounded-lg py-2 text-center text-[13px] font-bold transition-all duration-150"
                  style={{
                    background: isLogin ? "var(--surface)" : "transparent",
                    color: isLogin ? "var(--fg)" : "var(--fg-muted)",
                    boxShadow: isLogin ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 rounded-lg py-2 text-center text-[13px] font-bold transition-all duration-150"
                  style={{
                    background: !isLogin ? "var(--surface)" : "transparent",
                    color: !isLogin ? "var(--fg)" : "var(--fg-muted)",
                    boxShadow: !isLogin ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  Sign Up
                </Link>
              </div> */}

              {/* Form content injected here */}
              {children}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
