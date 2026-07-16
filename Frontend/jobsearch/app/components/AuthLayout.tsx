"use client";

import { usePathname } from "next/navigation";
import Logo from "./Logo";
import Image  from "next/image";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname?.includes("login");

  // Overlapping avatar details
  const avatars = [
    { label: "A", bg: "bg-[#0052cc]" },
    { label: "B", bg: "bg-[#1e5fff]" },
    { label: "C", bg: "bg-[#00a8e8]" },
    { label: "D", bg: "bg-[#0073e6]" },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-tr from-[#e8f0ff] via-[#f0f4ff] to-[#e8f8ff]">
      {/* Background blobs for premium depth */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute right-[-10rem] top-[-5rem] h-[500px] w-[500px] rounded-full bg-cyan-100/25 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[20%] h-[400px] w-[400px] rounded-full bg-blue-100/25 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* Left panel: Brand info & social proof */}
          <div className="hidden flex-col justify-center space-y-10 lg:flex">
            <Image
              src={"/navbarlogo.png"}
              alt="NextRole Logo"
              width={350}
              height={100}
              priority
              className="object-contain"
            />

            <div className="space-y-4">
              <p className="text-[26px] font-extrabold leading-[1.35] tracking-tight text-slate-800">
                {isLogin
                  ? "Welcome back! Your AI-powered career companion is ready to help you find your next opportunity."
                  : "Your AI-powered career companion. Upload your resume, get instant insights, and discover opportunities that match your skills."}
              </p>
            </div>

            {/* Feature lists */}
            <div className="space-y-6">
              {/* Feature 1 */}
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0052cc]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800">Instant Resume Analysis</h3>
                  <p className="mt-0.5 text-[13px] text-slate-500">Get your ATS score in seconds</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0052cc]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800">Skill Extraction</h3>
                  <p className="mt-0.5 text-[13px] text-slate-500">Automatic skill identification & ranking</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0052cc]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.32 11.32l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800">Smart Job Matching</h3>
                  <p className="mt-0.5 text-[13px] text-slate-500">AI-powered job recommendations</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Social Proof */}
            <div className="space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-slate-400">Trusted by job seekers worldwide</p>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {avatars.map((avatar, idx) => (
                    <span
                      key={idx}
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${avatar.bg} text-[11px] font-bold text-white ring-2 ring-white`}
                    >
                      {avatar.label}
                    </span>
                  ))}
                </div>
                <span className="text-[13px] font-bold text-slate-700">Join 10,000+ professionals</span>
              </div>
            </div>
          </div>

          {/* Right panel: Authentication Form Card */}
          <div className="flex flex-col items-center justify-center">
            {/* Mobile logo header */}
            <div className="mb-8 flex justify-center lg:hidden">
              <Logo />
            </div>
            
            <div className="w-full max-w-[490px] rounded-[24px] border border-blue-100/60 bg-white p-7 shadow-xl shadow-blue-950/[0.04] sm:p-10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
