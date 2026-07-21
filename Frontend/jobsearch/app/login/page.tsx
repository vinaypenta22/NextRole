"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "../components/AuthLayout";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import { saveAuth } from "../lib/auth";

import Logo from "../components/Logo";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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
        headers: { "Content-Type": "application/json" },
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

  function handleSandboxLogin() {
    saveAuth("sandbox-token", { id: 0, email: "dev@sandbox.local" });
    router.replace("/dashboard");
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center">
                <h2 className="text-[25px] font-black tracking-tight" style={{ color: "var(--fg)" }}>Login</h2>
                <p className="mt-1 text-[13px] font-medium" style={{ color: "var(--fg-muted)" }}>Access your dream opportunities.</p>
                <Logo />
              </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Email Address"
          name="email"
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="vinzy.p@pranathiss.com"
          autoComplete="email"
          required
          showEmailIcon
        />

        <FormInput
          label="Password"
          name="password"
          value={password}
          onChange={setPassword}
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          togglePassword
          // rightAction={
          //   <Link
          //     href="/forgot-password"
          //     className="text-[10.5px] font-bold uppercase tracking-[0.1em] hover:underline"
          //     style={{ color: "var(--accent)" }}
          //   >
          //     Forgot?
          //   </Link>
          // }
        />

        {/* Remember me */}
        <label className="flex cursor-pointer select-none items-center gap-2.5 text-[12.5px] font-medium" style={{ color: "var(--fg-muted)" }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--surface-border)] bg-[var(--surface)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          Remember me for quicker access next time.
        </label>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
            {error}
          </p>
        ) : null}

        <PrimaryButton
          type="submit"
          isLoading={loading}
          className="w-full py-3.5 text-[14px] tracking-wide"
        >
          <span>SIGN IN</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </PrimaryButton>
      </form>

      {/* Divider */}
      {/* <div className="relative my-4 flex items-center">
        <div className="flex-grow border-t" style={{ borderColor: "var(--surface-border)" }} />
        <span className="mx-3 flex-shrink text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--fg-subtle)" }}>
          or sandbox access
        </span>
        <div className="flex-grow border-t" style={{ borderColor: "var(--surface-border)" }} />
      </div> */}

      {/* Sandbox sign-in */}
      {/* <button
        type="button"
        onClick={handleSandboxLogin}
        className="flex w-full items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-[12.5px] font-bold transition hover:opacity-90 border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/5 text-amber-700 dark:text-amber-400"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        ONE-CLICK DEVELOPER SIGN-IN
      </button> */}


      {/* Footer */}
      <p className="mt-5 text-center text-[12.5px] font-medium" style={{ color: "var(--fg-muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-bold hover:underline" style={{ color: "var(--accent)" }}>
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
