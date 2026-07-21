"use client";

import { useState } from "react";

type FormInputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  togglePassword?: boolean;
  rightAction?: React.ReactNode;
  showEmailIcon?: boolean;
};

export default function FormInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required = false,
  togglePassword = false,
  rightAction,
  showEmailIcon = false,
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password" && togglePassword;
  const isEmail = type === "email" || showEmailIcon;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={name}
          className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--fg-muted)]"
        >
          {label}
        </label>
        {rightAction}
      </div>
      <div className="relative">
        {/* Left icon */}
        {isEmail && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] pointer-events-none">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="m2 7 10 7 10-7" />
            </svg>
          </span>
        )}
        {isPasswordField && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] pointer-events-none">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        )}
        <input
          id={name}
          name={name}
          type={isPasswordField && showPassword ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={`w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] text-[13.5px] text-[var(--fg)] outline-none transition placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] py-2.5 pr-11 ${
            isEmail || isPasswordField ? "pl-10" : "pl-4"
          }`}
        />
        {/* Right: eye toggle */}
        {isPasswordField ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-3.5 inline-flex items-center text-[var(--fg-subtle)] transition hover:text-[var(--fg)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
                <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c5 0 9 3.5 9 7a11.7 11.7 0 0 1-2.25 3.03" />
                <path d="M6.61 6.61A11.69 11.69 0 0 0 3 12c0 3.5 4 7 9 7a9.7 9.7 0 0 0 4.12-.9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                <circle cx="12" cy="12" r="2.8" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
