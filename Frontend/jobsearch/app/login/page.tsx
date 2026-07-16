"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "../components/AuthLayout";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import { saveAuth } from "../lib/auth";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Login failed.");
      }

      saveAuth(payload.access, {
        id: payload.user?.id,
        email: payload.user?.email,
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-[25px] font-black tracking-tight text-slate-800">Welcome Back</h2>
          <p className="mt-1 text-[13px] font-medium text-slate-500">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormInput
            label="Email Address"
            name="email"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <FormInput
            label="Password"
            name="password"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            togglePassword
            // rightAction={
            //   <a href="#" className="text-[12px] font-bold text-[#0052cc] hover:text-[#003fa3]">
            //     Forgot?
            //   </a>
            // }
          />

          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[13px] font-semibold text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#0052cc] focus:ring-[#0052cc]"
              />
              Remember me
            </label>
          </div>

          {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">{error}</p> : null}
          
          <PrimaryButton type="submit" isLoading={loading} className="w-full flex items-center justify-center gap-1.5 py-3.5">
            <span>Sign In</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </PrimaryButton>
        </form>

        <div className="text-center text-[13px] font-semibold text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#0052cc] hover:text-[#003fa3]">
            Create one
          </Link>
        </div>

        {/* <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">or</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[13.5px] font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.67 0 3.2.58 4.41 1.71l3.29-3.29C17.72 1.6 15.02 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.86 3A6.97 6.97 0 0 1 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61l3.71 2.88c2.17-2 3.73-4.94 3.73-8.62z"
            />
            <path fill="#FBBC05" d="M5.36 14.5a6.97 6.97 0 0 1 0-5v-3L1.5 3.5a11.96 11.96 0 0 0 0 14l3.86-3z" />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.71-2.88c-1.03.69-2.35 1.11-4.25 1.11a6.97 6.97 0 0 1-6.64-4.96l-3.86 3A11.96 11.96 0 0 0 12 23z"
            />
          </svg>
          <span>Continue with Google</span>
        </button> */}
      </div>
    </AuthLayout>
  );
}
