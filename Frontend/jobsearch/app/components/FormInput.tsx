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
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password" && togglePassword;

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
        {rightAction}
      </div>
      <div className="relative">
        <input
          name={name}
          type={isPasswordField && showPassword ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 pr-11 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#8b5cf6] focus:bg-white focus:ring-4 focus:ring-purple-100/50"
        />
        {isPasswordField ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-3.5 inline-flex items-center text-slate-400 transition hover:text-[#8b5cf6]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
                <path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c5 0 9 3.5 9 7a11.7 11.7 0 0 1-2.25 3.03" />
                <path d="M6.61 6.61A11.69 11.69 0 0 0 3 12c0 3.5 4 7 9 7a9.7 9.7 0 0 0 4.12-.9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
