export const AUTH_TOKEN_KEY = "jobsearch_access_token";
export const AUTH_USER_KEY = "jobsearch_user";
export const PROFILE_KEY = "jobsearch_profile";
export const RESUME_KEY = "jobsearch_resume";
export const APPLICATIONS_KEY = "jobsearch_applications";

export type AuthUser = {
  id?: number;
  email: string;
  name?: string;
};

export type ProfileData = {
  name: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  password?: string;
};

function setCookie(name: string, value: string, maxAgeHours = 24 * 7) {
  if (typeof window === "undefined") {
    return;
  }

  const maxAge = maxAgeHours * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof window === "undefined") {
    return;
  }

  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function getScopeSuffix() {
  if (typeof window === "undefined") {
    return "anonymous";
  }

  const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return "anonymous";
  }

  try {
    const user = JSON.parse(rawUser) as AuthUser;
    if (typeof user.id === "number" && Number.isFinite(user.id)) {
      return `user-${user.id}`;
    }
    if (typeof user.email === "string" && user.email.trim()) {
      return `email-${user.email.trim().toLowerCase()}`;
    }
  } catch {
    return "anonymous";
  }

  return "anonymous";
}

function scopedKey(baseKey: string) {
  return `${baseKey}:${getScopeSuffix()}`;
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY) || document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${AUTH_TOKEN_KEY}=`))
    ?.split("=")[1]
    ? decodeURIComponent(document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${AUTH_TOKEN_KEY}=`))?.split("=")[1] || "")
    : null;
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (token) {
    setCookie(AUTH_TOKEN_KEY, token);
  }
}

export function clearAuth() {
  if (typeof window === "undefined") {
    return;
  }

  const currentScope = getScopeSuffix();
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.localStorage.removeItem(`${PROFILE_KEY}:${currentScope}`);
  window.localStorage.removeItem(`${RESUME_KEY}:${currentScope}`);
  window.localStorage.removeItem(`${APPLICATIONS_KEY}:${currentScope}`);
  clearCookie(AUTH_TOKEN_KEY);
  clearCookie(AUTH_USER_KEY);
}

export function saveProfile(profile: ProfileData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(scopedKey(PROFILE_KEY), JSON.stringify(profile));
}

export function getProfile(): ProfileData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(scopedKey(PROFILE_KEY));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ProfileData;
  } catch {
    return null;
  }
}

export function saveResumeData(resumeData: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(scopedKey(RESUME_KEY), JSON.stringify(resumeData));
}

export function getResumeData() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(scopedKey(RESUME_KEY));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveApplications(applications: Array<Record<string, unknown>>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(scopedKey(APPLICATIONS_KEY), JSON.stringify(applications));
}

export function getApplications() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(scopedKey(APPLICATIONS_KEY));
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}
