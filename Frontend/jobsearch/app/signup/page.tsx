"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "../components/AuthLayout";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import { saveAuth } from "../lib/auth";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}`;

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError("Please complete every field.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, confirm_password: confirmPassword }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const firstError = payload?.confirm_password?.[0] || payload?.email?.[0] || payload?.message || "Registration failed.";
        throw new Error(firstError);
      }

      saveAuth("", {
        id: payload.data?.id,
        email: payload.data?.email,
        name: payload.data?.name,
      });
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-[25px] font-black tracking-tight text-slate-800">Create Account</h2>
          <p className="mt-1 text-[13px] font-medium text-slate-500">Start your career transformation today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Full Name"
            name="name"
            value={name}
            onChange={setName}
            placeholder="Alex Morgan"
            autoComplete="name"
            required
          />
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
            placeholder="Create a strong password"
            autoComplete="new-password"
            required
            togglePassword
          />
          <FormInput
            label="Confirm Password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            required
            togglePassword
          />

          <div className="flex items-start">
            <label className="flex items-start gap-2 cursor-pointer select-none text-[13px] font-semibold text-slate-500 leading-normal">
              <input
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span>
                I agree to the{" "}
                <a href="#" className="text-[#8b5cf6] hover:text-[#7c3aed]">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-[#8b5cf6] hover:text-[#7c3aed]">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">{error}</p> : null}
          
          <PrimaryButton type="submit" isLoading={loading} className="w-full flex items-center justify-center gap-1.5 py-3.5 mt-2">
            <span>Create Account</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </PrimaryButton>
        </form>

        <div className="text-center text-[13px] font-semibold text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-[#8b5cf6] hover:text-[#7c3aed]">
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
