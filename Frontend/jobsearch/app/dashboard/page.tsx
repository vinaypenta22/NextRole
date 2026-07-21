"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail, Phone, MapPin, Clock, Upload, CheckCircle2, Briefcase, Globe,
  Zap, Lightbulb, FlaskConical, Brain, TrendingUp, Bookmark, BookmarkCheck,
  X, Send, Bot, Loader2, RefreshCw, Plus, ExternalLink, Search,
} from "lucide-react";
import SignalShell from "../components/SignalShell";
import SectionCard from "../components/SectionCard";
import PrimaryButton from "../components/PrimaryButton";
import {
  clearAuth, getAccessToken, getCurrentUser, getProfile,
  getResumeData, saveResumeData,
} from "../lib/auth";
import { fetchCachedInterviewQuestions, fetchInterviewQuestions } from "../lib/resumeAi";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}`;
const PAGE_SIZE = 6;

const defaultProfile = { name: "", email: "", phone: "", location: "", bio: "" };

type ResumeSnapshot = {
  resume_id?: number;
  message?: string;
  is_resume_uploaded?: boolean;
  resume_details?: Record<string, unknown>;
  recommended_jobs?: Array<Record<string, unknown>>;
  resume_insights?: Record<string, unknown>;
};

type ActiveTab = "profile" | "applications" | "applied" | "saved" | "interview";

type JobSearchFilters = {
  location: string;
  employmentType: string;
  experience: string;
  posted: string;
  query: string;
};

type AppliedJob = {
  id: number;
  title: string;
  company: string;
  location: string;
  employment_type: string;
  work_mode: string;
  experience: string;
  posted_at: string;
  summary: string;
  description: string;
  apply_link: string;
  match_score: number;
  applied_at: string;
  raw_data?: Record<string, unknown>;
};

type ParsedResumeItem = {
  title: string;
  subtitle?: string;
  details?: string;
  bullets?: string[];
  date?: string;
};

type InterviewPrepItem = {
  skill?: string;
  batch_id?: string;
  level?: string;
  question?: string;
  tip?: string;
  answer?: string;
};

/* ─── Helpers ─── */
function pickString(source: Record<string, unknown> | undefined, keys: string[], fallback = "") {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function pickApplyLink(source: Record<string, unknown> | undefined) {
  if (!source) return "";
  const directLink = pickString(source, ["apply_link", "url", "job_apply_link", "job_apply_url", "source_link", "share_link"], "");
  if (directLink) return directLink;
  const applyOptions = Array.isArray(source.apply_options) ? source.apply_options : [];
  for (const option of applyOptions) {
    if (!option || typeof option !== "object") continue;
    const optionLink = pickString(option as Record<string, unknown>, ["link", "url", "apply_link"], "");
    if (optionLink) return optionLink;
  }
  return "";
}

function shortSummary(summary: string, limit = 180) {
  const cleaned = summary.trim();
  if (cleaned.length <= limit) return { text: cleaned, truncated: false };
  return { text: `${cleaned.slice(0, limit).trimEnd()}...`, truncated: true };
}

function normalizeParsedItems(value: unknown): ParsedResumeItem[] {
  if (!Array.isArray(value)) return [];
  const items: ParsedResumeItem[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const cleaned = item.trim();
      if (cleaned) items.push({ title: cleaned });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = pickString(record, ["title", "degree", "name", "role", "project_name", "institution"], "");
    const subtitle = pickString(record, ["subtitle", "institution", "company", "school", "stack", "technology"], "");
    const details = pickString(record, ["details", "description", "summary", "year", "years", "period", "duration"], "");
    const date = pickString(record, ["date", "period", "duration", "year", "years"], "");
    const bullets = Array.isArray(record.bullets) ? record.bullets.map((b) => String(b)).filter(Boolean) : [];
    if (!title && !subtitle && !details && !date && !bullets.length) continue;
    items.push({ title, subtitle, details, date, bullets });
  }
  return items;
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const item of value) {
    if (typeof item === "string") { const c = item.trim(); if (c) items.push(c); continue; }
    if (!item || typeof item !== "object") continue;
    const text = pickString(item as Record<string, unknown>, ["title", "name", "certification", "course", "label", "value", "details", "description"], "");
    if (text) items.push(text);
  }
  return items;
}

function normalizeInterviewPrepLevel(level: string) {
  const n = level.trim().toLowerCase();
  if (n.includes("basic") || n.includes("beginner")) return 0;
  if (n.includes("intermediate") || n.includes("mid")) return 1;
  if (n.includes("advanced") || n.includes("senior") || n.includes("expert")) return 2;
  if (n.includes("coding") || n.includes("code") || n.includes("challenge")) return 3;
  return 4;
}

function formatInterviewPrepLevel(level: string) {
  return level.trim() || "Practice";
}

function normalizeJob(job: Record<string, unknown>) {
  const title = pickString(job, ["title", "job_title", "role"], "Role");
  const company = pickString(job, ["company", "company_name", "employer_name"], "Company");
  const location = pickString(job, ["location", "job_location", "job_city"], "Remote");
  const employmentType = pickString(job, ["employment_type", "job_employment_type", "job_employment_types"], "Full-Time");
  const workMode = pickString(job, ["work_mode", "job_work_from_home", "job_work_mode"], "Hybrid");
  const experience = pickString(job, ["experience", "job_required_experience", "job_experience"], "");
  const postedAt = pickString(job, ["posted_at", "job_posted_at", "job_posted_date"], "");
  const description = stripTags(pickString(job, ["description", "job_description"], ""));
  const salary = pickString(job, ["salary", "job_salary_string", "job_salary"], "");
  const applyLink = pickApplyLink(job);
  const matchScoreRaw = job.match_score;
  const matchScore = typeof matchScoreRaw === "number" ? matchScoreRaw : Number(matchScoreRaw || 0);
  const skills = Array.isArray(job.skills) ? (job.skills as unknown[]).map(String).filter(Boolean) : [];

  return {
    ...job,
    title, company, location, employment_type: employmentType, work_mode: workMode,
    experience, posted_at: postedAt, salary, description, apply_link: applyLink,
    url: applyLink, match_score: Number.isFinite(matchScore) ? matchScore : 0, skills,
  };
}

/* ─── Compact company-initial avatar ─── */
const AVATAR_COLORS = [
  "#16a34a","#2563eb","#7c3aed","#ea580c","#0891b2",
  "#db2777","#65a30d","#d97706","#0f172a","#9333ea",
];
function companyColor(company: string) {
  let h = 0;
  for (let i = 0; i < company.length; i++) h = (h * 31 + company.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatDescription(desc: string) {
  if (!desc) return null;
  const lines = desc.split("\n");
  return (
    <div className="space-y-2.5 font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        const lower = trimmed.toLowerCase();
        const isHeader = 
          lower.includes("key responsibilities") || 
          lower.includes("required skills") || 
          lower.includes("preferred qualifications") ||
          lower.includes("responsibilities") ||
          lower.includes("skills & experience") ||
          lower.includes("qualifications") ||
          lower.includes("requirements") ||
          (trimmed.length < 40 && trimmed.endsWith(":"));

        if (isHeader) {
          const cleanHeader = trimmed.replace(/:$/, "");
          return (
            <h4 key={idx} className=" text-[13px] mt-4 mb-1 text-slate-900 dark:text-white">
              {cleanHeader}
            </h4>
          );
        }

        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*");
        if (isBullet) {
          const content = trimmed.substring(1).trim();
          return (
            <div key={idx} className="flex items-start gap-1.5 text-[12.5px] pl-1 text-slate-900 dark:text-zinc-300 leading-relaxed">
              <span className="text-[var(--accent)] mt-0.5 select-none">•</span>
              <span>{content}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-[12.5px] text-slate-500 dark:text-zinc-300 leading-relaxed pl-1">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

/* ─── Job Card ─── */
function JobCard({
  job, isApplied = false, isSaved = false, onApply, onSave, featured = false,
}: {
  job: Record<string, unknown>;
  isApplied?: boolean;
  isSaved?: boolean;
  onApply?: (job: Record<string, unknown>) => void;
  onSave?: (job: Record<string, unknown>) => void;
  featured?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalized = useMemo(() => normalizeJob(job), [job]);
  const matchScore = Math.max(0, Math.min(100, normalized.match_score));
  const scoreColor = matchScore >= 75 ? "#10b981" : matchScore >= 50 ? "#f59e0b" : "#ef4444";
  const initial = String(normalized.company || "C").charAt(0).toUpperCase();
  const avatarColor = companyColor(String(normalized.company));
  const tagSkills = normalized.skills.slice(0, 4);

  const cardStyle = featured
    ? { background: "#16181a", border: "1px solid rgba(255,255,255,0.05)" }
    : {};

  const titleColor = featured ? "text-white" : "text-slate-900 dark:text-white";
  const companyColorClass = featured ? "text-slate-350" : "text-slate-500 dark:text-zinc-400";
  const descColorClass = featured ? "text-slate-200" : "text-slate-650 dark:text-zinc-300";
  const separatorColor = featured ? "border-white/10" : "border-slate-100 dark:border-zinc-800";

  return (
    <article
      className={`group rounded-[26px] p-5.5 transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between ${
        featured ? "text-white bg-[#16181a] border border-white/5 shadow-xs hover:shadow-lg" : "tal-card"
      }`}
      style={cardStyle}
    >
      <div className="space-y-3.5">
        {/* Top Row: Circular progress on left, Title/Company in center, Bookmark on right */}
        <div className="flex items-start gap-3.5">
          {/* Left: Circular progress chart */}
          <div className="relative flex items-center justify-center h-12 w-12 shrink-0">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r={18}
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                className="text-slate-100 dark:text-zinc-800"
              />
              <circle
                cx="24"
                cy="24"
                r={18}
                stroke={scoreColor}
                strokeWidth="3"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 - (matchScore / 100) * 2 * Math.PI * 18}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <span className="absolute text-[10.5px] font-black text-slate-800 dark:text-slate-200">
              {matchScore.toFixed(0)}%
            </span>
          </div>

          {/* Center: Title & Company */}
          <div className="flex-1 min-w-0 pr-1">
            <h4 className={`text-[15.5px] font-display font-extrabold leading-snug tracking-tight ${titleColor}`}>
              {normalized.title}
            </h4>
            <p className={`text-[12.5px] font-sans font-semibold mt-0.5 ${companyColorClass}`}>
              {normalized.company}
            </p>
          </div>

          {/* Right: Bookmark Button */}
          <button
            type="button"
            onClick={() => onSave?.(job)}
            title={isSaved ? "Unsave" : "Save job"}
            className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full transition active:scale-95 shadow-xs cursor-pointer ${
              isSaved
                ? "text-white hover:opacity-95"
                : "bg-white dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/80 text-slate-400 dark:text-zinc-500 hover:text-slate-650"
            }`}
            style={isSaved ? { background: "linear-gradient(135deg, #0052cc 0%, #1e5fff 100%)" } : {}}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold font-sans pt-1">
          {[normalized.employment_type, normalized.work_mode, normalized.location].filter(Boolean).map((tag) => (
            <span key={tag} className="rounded-lg px-3 py-1.5 text-slate-600 dark:text-zinc-350 font-semibold" style={{ background: "var(--surface-hover)", border: "1px solid var(--surface-border)" }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {expanded && normalized.description && (
        <div className={`border-t mt-4 pt-3.5 ${separatorColor}`}>
          {formatDescription(normalized.description)}
        </div>
      )}

      {/* Bottom Actions Row */}
      <div className={`mt-5 flex items-center justify-between border-t pt-3.5 ${separatorColor}`}>
        <button
          type="button"
          onClick={() => setExpanded(p => !p)}
          className="text-[12.5px] font-bold cursor-pointer hover:underline font-sans flex items-center gap-1 text-[var(--accent)]"
        >
          <span>View details</span>
          <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div className="font-sans">
          {isApplied ? (
            <span className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-bold bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 shadow-xs">
              ✓ Applied
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onApply?.(job)}
              className="rounded-full bg-black text-white hover:opacity-90 active:scale-95 text-[12.5px] font-extrabold px-5 py-2 cursor-pointer shadow-xs"
            >
              Apply
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── Main dashboard content ─── */
function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Interview Prep states matching Screenshot 1
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Basic' | 'Intermediate' | 'Coding'>('Basic');
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  const user = getCurrentUser();

  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    requestedTab === "profile" || requestedTab === "applications" || requestedTab === "applied" || requestedTab === "saved" || requestedTab === "interview"
      ? requestedTab : "profile",
  );

  const [resumeData, setResumeData] = useState<ResumeSnapshot | null>(() => {
    return (getResumeData() as ResumeSnapshot | null) || null;
  });
  const profile = useMemo(() => {
    const cachedProfile = getProfile();
    if (cachedProfile) return { ...defaultProfile, ...cachedProfile, email: cachedProfile.email || user?.email || "" };
    return { ...defaultProfile, email: user?.email || "" };
  }, [user?.email]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>(() => {
    const cachedResume = getResumeData() as ResumeSnapshot | null;
    return Array.isArray(cachedResume?.recommended_jobs)
      ? (cachedResume.recommended_jobs as Array<Record<string, unknown>>).map(normalizeJob) : [];
  });
  const [originalJobs, setOriginalJobs] = useState<Array<Record<string, unknown>>>(() => {
    const cachedResume = getResumeData() as ResumeSnapshot | null;
    return Array.isArray(cachedResume?.recommended_jobs)
      ? (cachedResume.recommended_jobs as Array<Record<string, unknown>>) : [];
  });
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [uploadStep, setUploadStep] = useState(0);
  const [savedJobKeys, setSavedJobKeys] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "bot"; text: string; tab?: ActiveTab }[]>([
    { role: "bot", text: "Hi! I'm your NextRole assistant 🤖 Ask me anything about using the platform." },
  ]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const [savedJobs, setSavedJobs] = useState<Array<Record<string, unknown>>>([]);

  const [skillsState, setSkillsState] = useState<string[]>(() => {
    const cachedResume = getResumeData() as ResumeSnapshot | null;
    return Array.isArray(cachedResume?.resume_details?.skills)
      ? (cachedResume.resume_details.skills as string[]) : [];
  });
  const [newSkillText, setNewSkillText] = useState("");

  useEffect(() => {
    if (resumeData?.resume_details?.skills) {
      setSkillsState(resumeData.resume_details.skills as string[]);
    }
  }, [resumeData]);

  function handleAddSkill(newSkill: string) {
    if (!newSkill.trim() || !resumeData) return;
    if (skillsState.includes(newSkill.trim())) return;
    const updatedSkills = [...skillsState, newSkill.trim()];
    setSkillsState(updatedSkills);
    const nextResume = {
      ...resumeData,
      resume_details: {
        ...resumeData.resume_details,
        skills: updatedSkills,
      }
    };
    setResumeData(nextResume);
    saveResumeData(nextResume);
  }

  function handleRemoveSkill(skillToRemove: string) {
    if (!resumeData) return;
    const updatedSkills = skillsState.filter(s => s !== skillToRemove);
    setSkillsState(updatedSkills);
    const nextResume = {
      ...resumeData,
      resume_details: {
        ...resumeData.resume_details,
        skills: updatedSkills,
      }
    };
    setResumeData(nextResume);
    saveResumeData(nextResume);
  }

  function getJobKey(job: Record<string, unknown>) {
    const n = normalizeJob(job);
    return n.apply_link || `${n.title}::${n.company}`;
  }

  async function toggleSaveJob(job: Record<string, unknown>) {
    if (!user?.id) return;
    const key = getJobKey(job);
    const isSaved = savedJobKeys.has(key);
    if (isSaved) {
      const n = normalizeJob(job);
      const params = new URLSearchParams({ user_id: String(user.id) });
      if (n.apply_link) params.set("apply_link", n.apply_link);
      else { params.set("title", n.title); params.set("company", n.company); }
      await fetch(`${API_BASE}/saved-jobs/?${params}`, { method: "DELETE", headers: { Authorization: `${getAccessToken()}` } });
      setSavedJobKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
      setSavedJobs((prev) => prev.filter((j) => getJobKey(j) !== key));
    } else {
      await fetch(`${API_BASE}/saved-jobs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `${getAccessToken()}` },
        body: JSON.stringify({ user_id: user.id, job: normalizeJob(job) }),
      });
      setSavedJobKeys((prev) => new Set([...prev, key]));
      setSavedJobs((prev) => [{ ...normalizeJob(job) }, ...prev]);
    }
  }

  const HELP_QA: { patterns: string[]; answer: string; tab?: ActiveTab }[] = [
    { patterns: ["hi","hello","hey","hii","hai","hiii","good morning","good afternoon","good evening","greetings","yo","hola","how are you","what's up","sup"], answer: "Hello! 👋 Welcome to NextRole. I'm your AI career assistant. How can I help you today?" },
    { patterns: ["upload","resume","cv","pdf","docx"], answer: "To upload your resume, go to the Find Jobs tab. You'll find a file picker — choose a PDF or DOCX and click Upload Resume.", tab: "applications" },
    { patterns: ["job","find job","search job","match","recommend"], answer: "Matched jobs are shown in the Find Jobs tab after you upload your resume.", tab: "applications" },
    { patterns: ["apply","applied","application"], answer: "Click Apply on any job card in the Find Jobs tab. The job will be saved to your Applied tab.", tab: "applied" },
    { patterns: ["save","bookmark","saved job"], answer: "Click the bookmark icon on any job card to save it. Saved jobs are in the Saved tab.", tab: "saved" },
    { patterns: ["ats","score","ats score","resume score"], answer: "Your ATS score is shown in the Find Jobs tab under ATS Resume Insights.", tab: "applications" },
    { patterns: ["interview","question","prep","preparation"], answer: "Interview prep questions are in the Interview Prep tab — grouped by skill.", tab: "interview" },
    { patterns: ["profile","skills","education","project"], answer: "Your parsed profile is in the Profile tab.", tab: "profile" },
    { patterns: ["logout","sign out","log out"], answer: "Click the Logout icon in the top navigation bar to sign out." },
    { patterns: ["tab","navigate","navigation","where"], answer: "Use the tabs at the top: Profile, Find Jobs, Applied, Saved, Interview Prep." },
    { patterns: ["improvement","suggestion","improve resume"], answer: "Resume improvement suggestions are shown in the Find Jobs tab under Actionable Resume Edits.", tab: "applications" },
  ];

  function getBotReply(input: string): { text: string; tab?: ActiveTab } {
    const lower = input.toLowerCase();
    for (const qa of HELP_QA) {
      if (qa.patterns.some((p) => lower.includes(p))) return { text: qa.answer, tab: qa.tab };
    }
    return { text: "I'm not sure about that. Try asking about: uploading a resume, finding jobs, ATS score, interview prep, saving jobs, or navigating tabs." };
  }

  function sendChatMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const reply = getBotReply(trimmed);
    const userMsg = { role: "user" as const, text: trimmed };
    const botMsg = { role: "bot" as const, text: reply.text, tab: reply.tab };
    setChatMessages((prev) => [...prev, userMsg, botMsg]);
    setChatInput("");
    if (user?.id) {
      void fetch(`${API_BASE}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `${getAccessToken()}` },
        body: JSON.stringify({ user_id: user.id, messages: [{ role: "user", text: trimmed }, { role: "bot", text: reply.text, tab: reply.tab ?? "" }] }),
      });
    }
  }

  useEffect(() => {
    if (!chatOpen || chatHistoryLoaded || !user?.id) return;
    const currentUserId = user.id;
    async function loadChatHistory() {
      try {
        const response = await fetch(`${API_BASE}/chat/?user_id=${currentUserId}`, { headers: { Authorization: `${getAccessToken()}` } });
        const payload = await response.json();
        if (response.ok && Array.isArray(payload.results) && payload.results.length > 0) {
          const history = payload.results.map((m: { role: string; text: string; tab?: string }) => ({ role: m.role as "user" | "bot", text: m.text, tab: (m.tab || undefined) as ActiveTab | undefined }));
          setChatMessages(history);
        }
      } catch { /* keep default */ }
      setChatHistoryLoaded(true);
    }
    void loadChatHistory();
  }, [chatOpen, chatHistoryLoaded, user?.id]);

  const [filters, setFilters] = useState<JobSearchFilters>({ location: "all", employmentType: "all", experience: "any", posted: "any", query: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [interviewQuestionsBySkill, setInterviewQuestionsBySkill] = useState<Record<string, InterviewPrepItem[]>>({});
  const [interviewLoadingBySkill, setInterviewLoadingBySkill] = useState<Record<string, boolean>>({});
  const [interviewErrorBySkill, setInterviewErrorBySkill] = useState<Record<string, string | null>>({});

  const hasResume = Boolean(resumeData?.is_resume_uploaded || (resumeData?.resume_details && Object.keys(resumeData.resume_details).length > 0));

  const hasCustomFilters = useMemo(() => {
    return filters.location !== "all" || filters.employmentType !== "all" || filters.experience !== "any" || filters.posted !== "any" || filters.query.trim() !== "";
  }, [filters]);

  const token = getAccessToken();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!token) router.replace("/login"); }, [router, token]);

  useEffect(() => {
    if (!user?.id || resumeData) return;
    const currentUserId = user.id;
    let cancelled = false;
    async function restoreRecommendations() {
      try {
        const response = await fetch(`${API_BASE}/search-jobs/?user_id=${currentUserId}`, { headers: { Authorization: `${getAccessToken()}` } });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to restore recommendations.");
        const restoredJobs = Array.isArray(payload.recommended_jobs) ? payload.recommended_jobs : [];
        const nextResume: ResumeSnapshot = { is_resume_uploaded: Boolean(payload.is_resume_uploaded), resume_details: payload.resume_details || {}, recommended_jobs: restoredJobs, resume_insights: payload.resume_insights || {} };
        if (!cancelled && nextResume.is_resume_uploaded) {
          setResumeData(nextResume);
          saveResumeData(nextResume);
          setJobs(restoredJobs.map((job: Record<string, unknown>) => normalizeJob(job)));
          setOriginalJobs(restoredJobs);
        }
        else if (!cancelled) {
          setResumeData(null);
          setJobs([]);
          setOriginalJobs([]);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
          setOriginalJobs([]);
        }
      }
    }
    void restoreRecommendations();
    return () => { cancelled = true; };
  }, [resumeData, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;
    async function loadAppliedJobs() {
      try {
        const response = await fetch(`${API_BASE}/applied/?user_id=${currentUserId}`, { headers: { Authorization: `${getAccessToken()}` } });
        const payload = await response.json();
        if (response.ok) setAppliedJobs(Array.isArray(payload.results) ? (payload.results as AppliedJob[]) : []);
      } catch { /* keep */ }
    }
    void loadAppliedJobs();
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;
    async function loadSavedJobs() {
      try {
        const response = await fetch(`${API_BASE}/saved-jobs/?user_id=${currentUserId}`, { headers: { Authorization: `${getAccessToken()}` } });
        const payload = await response.json();
        if (response.ok && Array.isArray(payload.results)) {
          const j = payload.results as Array<Record<string, unknown>>;
          setSavedJobs(j);
          setSavedJobKeys(new Set(j.map((jj) => getJobKey(jj))));
        }
      } catch { /* keep */ }
    }
    void loadSavedJobs();
  }, [user?.id]);

  const resumeDetailsString = JSON.stringify(resumeData?.resume_details || null);

  useEffect(() => {
    if (activeTab !== "applications") return;
    let cancelled = false;
    async function loadRecommendations() {
      try {
        const currentResume = resumeData || getResumeData() || null;
        if (!currentResume?.resume_details || !user?.id) return;
        if (!hasCustomFilters && originalJobs.length > 0) {
          setJobs(originalJobs.map((j) => normalizeJob(j)));
          setSearching(false); return;
        }
        setSearching(true);
        const response = await fetch(`${API_BASE}/search-jobs/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `${getAccessToken()}` },
          body: JSON.stringify({ user_id: user?.id, resume_details: currentResume.resume_details || {}, filters: { location: filters.location, employment_type: filters.employmentType, experience: filters.experience, posted: filters.posted, query: filters.query, num_pages: 20 } }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to load recommendations.");
        const recommendedJobs = Array.isArray(payload.recommended_jobs) ? payload.recommended_jobs : [];
        const resumeInsights = payload.resume_insights || currentResume.resume_insights || {};
        if (!cancelled) {
          setJobs(recommendedJobs.map((j: Record<string, unknown>) => normalizeJob(j)));
          const nextResume = { ...(currentResume || {}), resume_details: payload.resume_details || currentResume.resume_details || {}, recommended_jobs: recommendedJobs, resume_insights: resumeInsights };
          setResumeData(nextResume); saveResumeData(nextResume); setPage(1);
          if (!hasCustomFilters) {
            setOriginalJobs(recommendedJobs);
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load recommendations.");
      } finally { if (!cancelled) setSearching(false); }
    }
    void loadRecommendations();
    return () => { cancelled = true; };
  }, [activeTab, hasCustomFilters, filters.location, filters.employmentType, filters.experience, filters.posted, filters.query, resumeDetailsString, user?.id]);

  useEffect(() => {
    if (!mounted || !token || activeTab !== "interview" || !user?.id || !resumeData?.resume_details) return;
    let cancelled = false;
    async function hydrateCachedInterviewQuestions() {
      try {
        const payload = await fetchCachedInterviewQuestions(resumeData?.resume_details || {}, user?.id || 0);
        if (cancelled) return;
        const next: Record<string, InterviewPrepItem[]> = {};
        for (const [skill, items] of Object.entries(payload.interview_questions_by_skill || {})) {
          next[skill] = Array.isArray(items) ? items.filter((item): item is InterviewPrepItem => Boolean(item && item.skill && item.level && item.question && item.answer)) : [];
        }
        setInterviewQuestionsBySkill(next);
      } catch { /* keep */ }
    }
    void hydrateCachedInterviewQuestions();
    return () => { cancelled = true; };
  }, [mounted, token, activeTab, user?.id, resumeData]);

  const resumeInsights = useMemo(() => (resumeData?.resume_insights as Record<string, unknown> | undefined) || {}, [resumeData]);
  const atsScore = Number(resumeInsights.ats_resume_score ?? 0);
  const resumeImprovementSuggestions = useMemo(() => {
    const raw = resumeInsights.resume_improvement_suggestions;
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => String(s)).filter(Boolean);
  }, [resumeInsights]);

  const interviewSkillNames = useMemo(() => {
    const parsedSkills = Array.isArray(resumeData?.resume_details?.skills)
      ? (resumeData?.resume_details?.skills as unknown[]).map((s) => String(s).trim()).filter(Boolean) : [];
    return Array.from(new Set(parsedSkills)).slice(0, 6);
  }, [resumeData]);

  async function loadInterviewPrep(skill: string, mode: "initial" | "reload" | "more" = "initial") {
    if (!resumeData?.resume_details || !user?.id || !skill) return;
    if (interviewLoadingBySkill[skill] && mode === "initial") return;
    setInterviewLoadingBySkill((prev) => ({ ...prev, [skill]: true }));
    setInterviewErrorBySkill((prev) => ({ ...prev, [skill]: null }));
    try {
      const payload = await fetchInterviewQuestions(skill, resumeData.resume_details, user.id, mode);
      const nextItems = Array.isArray(payload.interview_questions)
        ? payload.interview_questions.filter((item): item is InterviewPrepItem => Boolean(item && item.skill && item.level && item.question && item.answer)) : [];
      setInterviewQuestionsBySkill((prev) => {
        const current = prev[skill] || [];
        const merged = mode === "more" ? [...current, ...nextItems] : nextItems;
        return { ...prev, [skill]: merged };
      });
    } catch (err) {
      setInterviewErrorBySkill((prev) => ({ ...prev, [skill]: err instanceof Error ? err.message : "Unable to load interview prep." }));
    } finally {
      setInterviewLoadingBySkill((prev) => ({ ...prev, [skill]: false }));
    }
  }

  async function loadInterviewPrepForAll(mode: "initial" | "reload" | "more" = "initial") {
    if (!interviewSkillNames.length) return;
    await Promise.all(interviewSkillNames.map((s) => loadInterviewPrep(s, mode)));
  }

  const displayName = profile.name || String(resumeData?.resume_details?.name || user?.name || "");
  const displayRole = String(resumeData?.resume_details?.current_designation || "");
  const displayCompany = String(resumeData?.resume_details?.current_company || "");
  const displayEmail = String(resumeData?.resume_details?.email || profile.email || user?.email || "");
  const displayPhone = String(resumeData?.resume_details?.phone || profile.phone || "");
  const displayLocation = String(resumeData?.resume_details?.location || profile.location || "");
  const displayExperience = String(resumeData?.resume_details?.experience_years ?? "");
  const displayLinkedIn = String(resumeData?.resume_details?.linkedin || "");
  const displayGitHub = String(resumeData?.resume_details?.github || "");
  const skills = useMemo(() => {
    const s = Array.isArray(resumeData?.resume_details?.skills) ? (resumeData?.resume_details?.skills as unknown[]).map((sk) => String(sk)).filter(Boolean) : [];
    return s;
  }, [resumeData]);
  const educationItems = useMemo(() => normalizeParsedItems(resumeData?.resume_details?.education), [resumeData]);
  const projectItems = useMemo(() => normalizeParsedItems(resumeData?.resume_details?.projects), [resumeData]);
  const certificationItems = useMemo(() => normalizeTextList(resumeData?.resume_details?.certifications), [resumeData]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedJobs = jobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateFilter<K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  async function refreshAppliedJobs() {
    if (!user?.id) return;
    try {
      const response = await fetch(`${API_BASE}/applied/?user_id=${user.id}`, { headers: { Authorization: `${getAccessToken()}` } });
      const payload = await response.json();
      if (response.ok && Array.isArray(payload.results)) setAppliedJobs(payload.results as AppliedJob[]);
    } catch { /* keep */ }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null); setSuccess(null);
    if (!selectedFile || !user?.id) { setError("Please choose a resume file before uploading."); return; }
    const formData = new FormData();
    formData.append("resume", selectedFile);
    formData.append("user_id", String(user.id));
    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;
    let t4: ReturnType<typeof setTimeout> | undefined;
    let t5: ReturnType<typeof setTimeout> | undefined;
    try {
      setUploading(true); setUploadStep(1);
      t2 = setTimeout(() => setUploadStep(2), 3500);
      t3 = setTimeout(() => setUploadStep(3), 7500);

      // 1. Upload and parse resume
      const response = await fetch(`${API_BASE}/upload/`, { method: "POST", headers: { Authorization: `${getAccessToken()}` }, body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Resume upload failed.");

      // Transition loading indicator step
      clearTimeout(t2); clearTimeout(t3);
      setUploadStep(4);

      // 2. Fetch recommendations before closing upload screen
      const searchResponse = await fetch(`${API_BASE}/search-jobs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `${getAccessToken()}` },
        body: JSON.stringify({
          user_id: user.id,
          resume_details: payload.resume_details || {},
          filters: { location: "all", employment_type: "all", experience: "any", posted: "any", query: "", num_pages: 20 },
        }),
      });
      const searchPayload = await searchResponse.json();
      const recommendedJobs = Array.isArray(searchPayload.recommended_jobs) ? searchPayload.recommended_jobs : [];
      const resumeInsights = searchPayload.resume_insights || payload.resume_insights || {};

      setUploadStep(5);

      const nextResume: ResumeSnapshot = {
        resume_id: payload.resume_id,
        message: payload.message,
        is_resume_uploaded: true,
        resume_details: payload.resume_details,
        recommended_jobs: recommendedJobs,
        resume_insights: resumeInsights,
      };

      setResumeData(nextResume);
      saveResumeData(nextResume);
      setJobs(recommendedJobs.map(normalizeJob));
      setOriginalJobs(recommendedJobs);
      setSelectedFile(null);
      setActiveTab("applications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
      setUploading(false); setUploadStep(0);
    }
  }

  async function handleApply(job: Record<string, unknown>) {
    if (!user?.id) return;
    const normalized = normalizeJob(job);
    try {
      const response = await fetch(`${API_BASE}/applied/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `${getAccessToken()}` }, body: JSON.stringify({ user_id: user.id, job: normalized }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to save applied job.");
      const key = getJobKey(job);
      if (savedJobKeys.has(key)) {
        const params = new URLSearchParams({ user_id: String(user.id) });
        if (normalized.apply_link) params.set("apply_link", normalized.apply_link);
        else { params.set("title", normalized.title); params.set("company", normalized.company); }
        await fetch(`${API_BASE}/saved-jobs/?${params}`, { method: "DELETE", headers: { Authorization: `${getAccessToken()}` } });
        setSavedJobKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
        setSavedJobs((prev) => prev.filter((j) => getJobKey(j) !== key));
      }
      await refreshAppliedJobs();
      if (normalized.apply_link) window.open(normalized.apply_link, "_blank", "noopener,noreferrer");
      setSuccess("Application saved and the external page has been opened.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save applied job.");
      setTimeout(() => setError(null), 4000);
    }
  }

  function handleLogout() { clearAuth(); router.replace("/login"); }

  const initials = useMemo(() => displayName.split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase() || "VP", [displayName]);

  /* ── Loading / uploading states ── */
  if (!mounted || !token) {
    return <div className="flex min-h-screen items-center justify-center text-[14px] font-semibold" style={{ color: "var(--fg-muted)" }}>Loading dashboard...</div>;
  }

  const uploadSteps = [
    { label: "Reading resume", icon: "📄" },
    { label: "Extracting skills", icon: "🔍" },
    { label: "Finding ATS score", icon: "📊" },
    { label: "Searching jobs", icon: "💼" },
    { label: "Preparing interview questions", icon: "🧠" },
  ];

  if (uploading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-md rounded-3xl border p-10 shadow-xl" style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}>
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl mb-4" style={{ background: "var(--accent-soft)" }}>
              {uploadSteps[(uploadStep || 1) - 1]?.icon}
            </div>
            <h2 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>Analyzing your resume</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--fg-muted)" }}>This takes about 30–60 seconds. Please wait.</p>
          </div>
          <div className="space-y-3">
            {uploadSteps.map((step, idx) => {
              const stepNum = idx + 1;
              const isDone = uploadStep > stepNum;
              const isActive = uploadStep === stepNum;
              return (
                <div key={step.label} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500 border ${isDone ? "border-emerald-100" : isActive ? "border-[var(--accent-soft)]" : "border-[var(--surface-border)] opacity-40"}`} style={{ background: isDone ? "rgba(22,163,74,0.07)" : isActive ? "var(--accent-soft)" : "var(--surface)" }}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${isDone ? "bg-emerald-500 text-white" : isActive ? "text-white" : "text-[var(--fg-subtle)]"}`} style={isActive ? { background: "var(--accent)" } : isDone ? {} : { background: "var(--surface-border)" }}>
                    {isDone ? "✓" : stepNum}
                  </div>
                  <span className={`text-[13.5px] font-semibold ${isDone ? "text-emerald-700" : ""}`} style={!isDone ? { color: isActive ? "var(--accent)" : "var(--fg-subtle)" } : {}}>
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto flex gap-1">
                      {[0,1,2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: `${i * 0.15}s` }} />)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-border)" }}>
            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${((uploadStep || 1) / uploadSteps.length) * 100}%`, background: "linear-gradient(90deg, var(--accent), #f59e0b)" }} />
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
            Step {uploadStep || 1} of {uploadSteps.length}
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     MAIN RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <SignalShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
      savedCount={savedJobs.length}
      initials={initials}
    >
      <div className="space-y-6" style={{marginTop:"20px"}}>

        {/* ── WELCOME HEADER (all tabs) ── */}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: "var(--fg)" }}>
            Welcome back, {displayName.toUpperCase() || "USER"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
            <span>{jobs.length} new job matches found for you today</span>
            {atsScore > 0 && (
              <>
                <span className="text-[var(--fg-subtle)]">•</span>
                <span>CV Score: <strong className="text-emerald-600">{atsScore}/100</strong></span>
              </>
            )}
            {interviewSkillNames.length > 0 && (
              <>
                <span className="text-[var(--fg-subtle)]">•</span>
                <span>Interview Preparedness: <strong style={{ color: "#f59e0b" }}>{Math.round((Object.values(interviewQuestionsBySkill).filter(v => v.length > 0).length / Math.max(1, interviewSkillNames.length)) * 100)}%</strong></span>
              </>
            )}
          </div>
        </div>

        {/* ── NO RESUME: Upload widget ── */}
        {!hasResume && (
          <SectionCard
            title="Upload your resume"
            description="Add a resume to unlock your profile snapshot, matched jobs, and applied job tracking."
            icon={<Upload size={16} />}
          >
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mt-4">
              <form onSubmit={handleUpload} className="space-y-4">
                <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-5 py-6 text-center transition hover:opacity-90" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full shadow-sm" style={{ background: "var(--surface)" }}>
                    <Upload className="h-5 w-5" style={{ color: "var(--accent)" }} />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: "var(--fg)" }}>
                      {selectedFile ? selectedFile.name : "Drop your PDF or DOCX resume here"}
                    </p>
                    <p className="text-[12px] mt-1" style={{ color: "var(--fg-muted)" }}>
                      {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "Supports PDF, DOCX · Max 10 MB"}
                    </p>
                  </div>
                  <input type="file" accept=".pdf,.docx" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} className="max-w-[200px] text-[12px]" />
                </label>
                <PrimaryButton type="submit" isLoading={uploading} className="w-full py-3.5">
                  Upload Resume
                </PrimaryButton>
                {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">{error}</p>}
                {success && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{success}</p>}
              </form>
              <div className="rounded-xl border p-5" style={{ borderColor: "var(--surface-border)", background: "var(--surface-hover)" }}>
                <p className="text-[10.5px] font-extrabold uppercase tracking-wider mb-4" style={{ color: "var(--fg-subtle)" }}>What you&apos;ll get</p>
                <div className="space-y-3">
                  {["Resume-driven job query built from your current role.", "Fresh job recommendations fetched with ATS matching.", "Applied jobs saved in the database and tracked."].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border p-3" style={{ background: "var(--surface)", borderColor: "var(--surface-border)" }}>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--fg-muted)" }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ══════════════════════════════════════════════
            TAB: PROFILE
        ══════════════════════════════════════════════ */}
        {hasResume && activeTab === "profile" && (
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            {/* Left: Profile card */}
            <div className="tal-card rounded-[26px] p-6 h-fit shadow-xs hover:shadow-lg transition-all duration-300 relative border-t-4 border-[var(--accent)]">

              <div className="flex flex-col items-center text-center relative mt-2">
                <div className="flex h-20 w-20 items-center justify-center rounded-full text-[28px] font-black text-white shadow-lg bg-gradient-to-r from-[#0052cc] to-[#1e5fff]">
                  {initials}
                </div>
                <div className="mt-4">
                  <h2 className="text-[18px] font-bold tracking-tight" style={{ color: "var(--fg)" }}>{displayName || "Your Name"}</h2>
                  <p className="mt-0.5 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>{displayRole || "Designation"}</p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-muted)" }}>{displayCompany || "Company"}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t pt-5" style={{ borderColor: "var(--surface-border)" }}>
                {[
                  { icon: <Mail size={14} />, label: displayEmail || "Email not parsed" },
                  { icon: <Phone size={14} />, label: displayPhone || "Phone not parsed" },
                  { icon: <MapPin size={14} />, label: displayLocation || "Location not parsed" },
                  {
                    icon: <FlaskConical size={14} />,
                    label: typeof displayExperience === "string"
                      ? (displayExperience.toLowerCase().includes("experience") || displayExperience.toLowerCase().includes("yr")
                          ? displayExperience
                          : `${displayExperience} yrs experience`)
                      : displayExperience
                        ? `${displayExperience} yrs experience`
                        : "Experience not parsed"
                  },
                  { icon: <Globe size={14} />, label: displayLinkedIn || "linkedin.com/-" },
                  { icon: <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>, label: displayGitHub || "github.com/-" },
                ].map(({ icon, label }, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
                    <span style={{ color: "var(--fg-subtle)" }}>{icon}</span>
                    <span className="truncate">{label}</span>
                  </div>
                ))}
              </div>

              {skills.length > 0 && (
                <div className="mt-5 border-t pt-4 flex items-center justify-between" style={{ borderColor: "var(--surface-border)" }}>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--fg-subtle)]">
                    Skills Identified:
                  </p>
                  <span className="text-white font-extrabold px-2.5 py-0.5 rounded-md text-[11px] font-mono shadow-xs bg-gradient-to-r from-[#0052cc] to-[#1e5fff]">
                    {skills.length}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Details */}
            <div className="space-y-5">
              {/* Technical Skills */}
              <SectionCard
                title="Technical Skills"
                icon={<svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>}
              >
                <div className="flex flex-wrap gap-2 mt-4 font-sans">
                  {skillsState.length ? skillsState.map((skill) => (
                    <span key={skill} className="inline-flex items-center rounded-full border border-slate-200/50 dark:border-zinc-800 px-3.5 py-1.5 text-[12.5px] font-bold" style={{ background: "var(--surface-hover)", color: "var(--fg)" }}>
                      {skill}
                    </span>
                  )) : <span className="text-[13.5px]" style={{ color: "var(--fg-muted)" }}>No skills parsed yet.</span>}
                </div>
              </SectionCard>

              {/* Education */}
              <SectionCard
                title="Education"
                icon={<svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>}
              >
                {educationItems.length ? (
                  <div className="space-y-4 mt-4">
                    {educationItems.map((item, i) => (
                      <div key={`sinay${item.title || i}`} className="space-y-1 font-sans">
                        <h4 className="text-[15.5px] font-bold text-slate-900 dark:text-white leading-snug">{item.title || "Education"}</h4>
                        {item.subtitle && <p className="text-[12.5px] text-slate-500 dark:text-zinc-400 font-semibold">{item.subtitle}</p>}
                        {item.date && (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-slate-400 dark:text-zinc-500 font-medium">
                            <Clock size={13} /> <span>{item.date}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <div className="text-[13.5px] mt-4 font-medium text-[var(--fg-muted)]">No education details parsed yet.</div>}
              </SectionCard>

              {/* Projects */}
              <SectionCard
                title="Projects"
                icon={<Briefcase size={16} style={{ color: "var(--accent)" }} />}
              >
                {projectItems.length ? (
                  <div className="space-y-6 mt-4">
                    {projectItems.map((item, i) => (
                      <article key={`${item.title || i}`} className="tal-card rounded-[26px] p-5 shadow-xs hover:shadow-lg transition-all duration-300">
                        <h4 className="text-[15px] font-bold font-display" style={{ color: "var(--fg)" }}>{item.title || "Project"}</h4>
                        {item.subtitle && <p className="mt-1 font-mono text-[11px] font-bold tracking-wider uppercase text-[var(--accent)]">TECH STACK: {item.subtitle}</p>}
                        {item.bullets?.length ? (
                          <ul className="mt-3.5 space-y-2">
                            {item.bullets.map((bullet, bi) => (
                              <li key={bi} className="flex items-start gap-2 text-[12.5px] leading-relaxed font-sans text-slate-600 dark:text-slate-350">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        ) : item.details ? <p className="mt-2.5 text-[13px] leading-relaxed font-sans text-slate-600 dark:text-slate-350">{item.details}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : <div className="text-[13.5px] mt-4 font-medium text-[var(--fg-muted)]">No project details parsed yet.</div>}
              </SectionCard>

              {/* Certifications */}
              <SectionCard
                title="Certifications & Credentials"
                icon={<svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>}
              >
                {certificationItems.length ? (
                  <div className="flex flex-wrap gap-2 mt-4 font-sans">
                    {certificationItems.map((cert) => (
                      <span key={cert} className="rounded-full border border-slate-200/50 dark:border-zinc-800 px-3.5 py-1.5 text-[12.5px] font-bold" style={{ background: "var(--surface-hover)", color: "var(--fg-muted)" }}>{cert}</span>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center mt-4">
                    <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-300 dark:text-zinc-700 animate-pulse mb-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.65 17.56L17.5 12h-11L4.35 17.56a1 1 0 0 0 .54 1.3l2.87 1.13a1 1 0 0 0 1-.16L12 18.25l3.24 1.58a1 1 0 0 0 1 .16l2.87-1.13a1 1 0 0 0 .54-1.3z" /></svg>
                    <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">No certifications parsed yet</p>
                    <p className="text-[11.5px] text-slate-400 mt-1 max-w-[280px]">
                      Scan your resume in the <strong className="cursor-pointer hover:underline" style={{ color: "var(--accent)" }} onClick={() => setActiveTab("applications")}>Find Jobs</strong> tab to extract credentials automatically!
                    </p>
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: FIND JOBS (applications)
        ══════════════════════════════════════════════ */}
        {hasResume && activeTab === "applications" && (
          <div className="space-y-5">
            {/* Top two-col: AI card + Resume edits */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* AI finder dark card */}
              {/* AI finder dark card */}
              <div className="bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617] text-white rounded-[28px] p-6 shadow-xl relative overflow-hidden border border-[#1e293b] flex flex-col min-h-[280px]">
                {/* Ambient Glowing Blur Layer */}
                <div className="absolute top-[-20%] right-[-10%] w-44 h-44 rounded-full bg-indigo-500/20 blur-[60px] pointer-events-none" />

                <div className="flex flex-col grow mb-4">
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 animate-pulse text-[#fbbf24]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9zM19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /></svg>
                    </span>
                    <h3 className="text-base font-extrabold tracking-tight font-sans bg-clip-text text-transparent bg-gradient-to-r from-[#fbbf24] via-[#fde047] to-[#34d399]">
                      Let AI find your ideal job
                    </h3>
                  </div>
                  <p className="text-[11px] text-indigo-200/80 leading-relaxed font-medium mb-3">
                    Our advanced match engine scans your skills, credentials, and experience to connect you instantly with verified positions.
                  </p>
                  <label className="border border-dashed border-indigo-500/40 rounded-2xl p-4 text-center bg-white/5 hover:bg-white/10 hover:border-indigo-400 transition cursor-pointer group flex flex-col items-center justify-center relative z-10 grow">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-[#a5b4fc] mb-2">
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    </span>
                    <p className="text-xs font-bold text-white truncate max-w-[280px]">
                      {selectedFile ? selectedFile.name : "Choose PDF/DOCX Resume"}
                    </p>
                    <p className="text-[9px] text-[#a5b4fc]/70 mt-0.5">
                      Support PDF, DOCX, TXT (Max 10MB)
                    </p>
                    <input type="file" accept=".pdf,.docx" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} className="hidden" />
                  </label>
                </div>
                <form onSubmit={handleUpload} className="w-full relative z-10">
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="w-full py-2.5 px-4 bg-white hover:bg-[#f5f3ff] text-[#020617] font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {uploading ? "Analyzing resume..." : "Get Matched"}
                  </button>
                </form>
              </div>

              {/* Actionable Resume Edits */}
              <div className="tal-card rounded-[26px] p-6 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between min-h-[260px]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-orange-500 fill-orange-500" stroke="none"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9zM19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /></svg>
                    <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-orange-600 font-sans">Actionable Resume Edits</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-450 dark:text-zinc-500 font-sans font-semibold mb-3">
                    Based on ATS matching parameters and the parsed resume scan, we recommend modifying these sections to improve match probability.
                  </p>
                  {resumeImprovementSuggestions.length ? (
                    <div className="space-y-2 font-sans">
                      {resumeImprovementSuggestions.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-start gap-2.5 rounded-xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/20 dark:bg-zinc-900/20 px-3.5 py-2">
                          <span className="mt-0.5 shrink-0 text-emerald-500 text-[12.5px] font-black">✓</span>
                          <p className="text-[12.5px] font-bold text-slate-700 dark:text-slate-350 leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] font-sans font-semibold" style={{ color: "var(--fg-muted)" }}>
                      Based on ATS matching parameters, we recommend uploading your resume to get tailored improvement suggestions.
                    </p>
                  )}
                </div>
                {atsScore > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t pt-3 font-sans" style={{ borderColor: "var(--surface-border)" }}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">ATS Match Score Estimate</span>
                    <span className="rounded-md bg-emerald-500/10 dark:bg-emerald-950/20 px-2 py-0.5 text-[12.5px] font-black text-emerald-600 dark:text-emerald-400 font-mono shadow-xs">
                      {atsScore}%
                    </span>
                  </div>
                )}
              </div>
            </div>
 <div className="flex items-end justify-between gap-4 mt-8 mb-4 border-b pb-3" style={{ borderColor: "var(--surface-border)" }}>
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-none">
                  Recommended Job Openings
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold font-sans mt-1.5">
                  Showing <span className="text-[var(--accent)] font-extrabold bg-[var(--accent)]/10 px-2 py-0.5 rounded-md">{jobs.length}</span> active job matches for your profile criteria
                </p>
              </div>
              <div className="text-[12.5px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                Page {currentPage} of {totalPages}
              </div>
            </div>
            {/* Search & Filter bar */}
            <div className="tal-card rounded-[26px] p-5 shadow-xs hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Search size={14} style={{ color: "var(--fg-muted)" }} />
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--fg)" }}>Search &amp; Filter Jobs</span>
                </div>
                <button type="button" onClick={() => { setFilters({ location: "all", employmentType: "all", experience: "any", posted: "any", query: "" }); setSearchQuery(""); }} className="text-[12.5px] font-bold  cursor-pointer" style={{ color: "var(--accent)" }}>
                  Clear Filters
                </button>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr_auto]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">Job Title / Keywords</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    </span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") updateFilter("query", searchQuery); }}
                      placeholder="UI Designer, React..."
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 pl-9 pr-3 py-2 text-[12.5px] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                      style={{ background: "var(--surface)", color: "var(--fg)" }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">Location</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    </span>
                    <input value={filters.location === "all" ? "" : filters.location} onChange={(e) => updateFilter("location", e.target.value || "all")} placeholder="Remote, India..." className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 pl-9 pr-3 py-2 text-[12.5px] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]" style={{ background: "var(--surface)", color: "var(--fg)" }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">Experience Level</label>
                  <div className="relative">
                    <select value={filters.experience} onChange={(e) => updateFilter("experience", e.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 dark:border-zinc-800 px-3 py-2 pr-8 text-[12.5px] outline-none transition focus:border-[var(--accent)]" style={{ background: "var(--surface)", color: "var(--fg)" }}>
                      <option value="any">All Levels</option>
                      <option value="0-2">0–2 yrs</option>
                      <option value="3-5">3–5 yrs</option>
                      <option value="5+">5+ yrs</option>
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--fg-subtle)]">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">Job Type</label>
                  <div className="relative">
                    <select value={filters.employmentType} onChange={(e) => updateFilter("employmentType", e.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 dark:border-zinc-800 px-3 py-2 pr-8 text-[12.5px] outline-none transition focus:border-[var(--accent)]" style={{ background: "var(--surface)", color: "var(--fg)" }}>
                      <option value="all">All Types</option>
                      <option value="Full-Time">Full-Time</option>
                      <option value="Part-Time">Part-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--fg-subtle)]">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">Work Schedule</label>
                  <div className="relative">
                    <select value={filters.posted} onChange={(e) => updateFilter("posted", e.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 dark:border-zinc-800 px-3 py-2 pr-8 text-[12.5px] outline-none transition focus:border-[var(--accent)]" style={{ background: "var(--surface)", color: "var(--fg)" }}>
                      <option value="any">All Schedules</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--fg-subtle)]">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => updateFilter("query", searchQuery)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-black hover:bg-slate-900 text-white font-extrabold text-[12.5px] py-2 px-5 transition duration-150 active:scale-[0.97] shadow-sm font-sans cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dedicated Jobs Header Segment */}
           

            {/* Job grid (3-col) */}
            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">{error}</p>}
            {success && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{success}</p>}
            {searching ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin h-8 w-8" style={{ color: "var(--accent)" }} />
              </div>
            ) : pagedJobs.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pagedJobs.map((job, index) => {
                  const n = normalizeJob(job);
                  const isApplied = appliedJobs.some((a) => a.title === n.title && a.company === n.company);
                  // const isFeatured = index === 2; // Highlight the 3rd card
                  return (
                    <JobCard
                      key={`${n.title}-${index}`}
                      job={job}
                      isApplied={isApplied}
                      isSaved={savedJobKeys.has(getJobKey(job))}
                      onApply={handleApply}
                      onSave={toggleSaveJob}
                      // featured={isFeatured}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border py-12 text-center text-sm font-semibold" style={{ borderColor: "var(--surface-border)", background: "var(--surface)", color: "var(--fg-muted)" }}>
                Upload a resume to populate matched roles here.
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-full border px-5 py-2 text-[13px] font-semibold transition hover:bg-[var(--surface-hover)] disabled:opacity-40" style={{ borderColor: "var(--surface-border)", color: "var(--fg-muted)" }}>
                  Previous
                </button>
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--fg-muted)" }}>Page {currentPage} of {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-full px-5 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-40" style={{ background: "var(--tab-active-bg)" }}>
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: APPLIED
        ══════════════════════════════════════════════ */}
        {hasResume && activeTab === "applied" && (
          <div className="space-y-4">
            {/* Application Tracker banner */}
            <div className="tal-card rounded-[26px] p-5 shadow-xs hover:shadow-lg transition-all duration-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                  <Briefcase size={20} />
                </span>
                <div>
                  <h3 className="text-[15px] font-bold" style={{ color: "var(--fg)" }}>Application Tracker</h3>
                  <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>Manage and follow up on submitted resumes.</p>
                </div>
              </div>
              <div className="text-right pr-2">
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{appliedJobs.length}</p>
                <p className="text-[9px] font-extrabold tracking-wider uppercase text-slate-400 mt-1.5 font-mono">TOTAL SUBMISSIONS</p>
              </div>
            </div>

            {/* Applied job rows */}
            {appliedJobs.length ? (
              <div className="space-y-3 mt-4">
                {appliedJobs.map((job) => {
                  const matchScore = Math.max(0, Math.min(100, job.match_score || 0));
                  const scoreColor = matchScore >= 75 ? "#16a34a" : matchScore >= 50 ? "#d97706" : "#e11d48";
                  return (
                    <div key={job.id} className="tal-card rounded-[26px] p-5 shadow-xs hover:shadow-lg transition-all duration-300 flex items-center justify-between gap-4 border border-slate-100 dark:border-zinc-800/80">
                      <div className="space-y-1 font-sans">
                        {/* Row 1: Company Name & Match Score */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] text-slate-400 dark:text-zinc-500 font-bold">{job.company}</span>
                          {matchScore > 0 && (
                            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold" style={{ background: `${scoreColor}14`, color: scoreColor }}>
                              {matchScore.toFixed(0)}% Match
                            </span>
                          )}
                        </div>
                        {/* Row 2: Job Title */}
                        <h4 className="text-[15.5px] font-bold text-slate-900 dark:text-white leading-snug">{job.title}</h4>
                        {/* Row 3: Location and Date */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400 dark:text-zinc-500 font-medium">
                          {job.location && (
                            <div className="flex items-center gap-1">
                              <MapPin size={13} />
                              <span>{job.location}</span>
                            </div>
                          )}
                          {job.applied_at && (
                            <div className="flex items-center gap-1">
                              <Clock size={13} />
                              <span>Applied {new Date(job.applied_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status and Action Link on the right */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 shadow-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          In Review
                        </span>
                        {job.apply_link && (
                          <a
                            href={job.apply_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/50 dark:border-zinc-800 transition hover:bg-[var(--surface-hover)] cursor-pointer"
                            style={{ color: "var(--fg-muted)" }}
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border py-12 text-center" style={{ borderColor: "var(--surface-border)", background: "var(--surface)" }}>
                <p className="text-[14px] font-semibold" style={{ color: "var(--fg-muted)" }}>No applied jobs yet.</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--fg-subtle)" }}>Apply to a role from Find Jobs to store it here.</p>
              </div>
            )}

            {/* Footer links */}
            <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--surface-border)" }}>
              <button type="button" onClick={() => setActiveTab("applications")} className="text-[12.5px] font-semibold transition hover:underline" style={{ color: "var(--fg-muted)" }}>
                ← Back to job matches
              </button>
              <button type="button" onClick={() => setActiveTab("profile")} className="text-[12.5px] font-semibold transition hover:underline" style={{ color: "var(--fg-muted)" }}>
                Update profile settings →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: SAVED
        ══════════════════════════════════════════════ */}
        {hasResume && activeTab === "saved" && (
          <div className="space-y-4">
            {/* Header: Saved Roles */}
            <div className="tal-card rounded-[26px] p-5 shadow-xs hover:shadow-lg transition-all duration-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Bookmark size={20} className="fill-[var(--accent)]" />
                </span>
                <div>
                  <h3 className="text-[15px] font-bold" style={{ color: "var(--fg)" }}>Saved Roles</h3>
                  <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>Keep track of listings you want to apply to later.</p>
                </div>
              </div>
              <div className="text-right pr-2">
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{savedJobs.length}</p>
                <p className="text-[9px] font-extrabold tracking-wider uppercase text-slate-400 mt-1.5 font-mono">TOTAL BOOKMARKS</p>
              </div>
            </div>

            {/* List of Saved Jobs */}
            {savedJobs.length ? (
              <div className="space-y-3 mt-4">
                {savedJobs.map((job, idx) => {
                  const n = normalizeJob(job);
                  const initial = String(n.company || "C").charAt(0).toUpperCase();
                  const avatarColor = companyColor(String(n.company));
                  const isApplied = appliedJobs.some((a) => a.title === n.title && a.company === n.company);
                  const matchScore = Math.max(0, Math.min(100, n.match_score));
                  const scoreColor = matchScore >= 75 ? "#16a34a" : matchScore >= 50 ? "#d97706" : "#e11d48";
                  return (
                    <div
                      key={`saved-tab-${n.apply_link || idx}`}
                      className="tal-card rounded-[26px] p-5 shadow-xs hover:shadow-lg transition-all duration-300 flex items-center justify-between gap-4 border border-slate-100 dark:border-zinc-800/80"
                    >
                      <div className="space-y-1 font-sans">
                        {/* Row 1: Company Name & Match Score */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] text-slate-400 dark:text-zinc-500 font-bold">{n.company}</span>
                          {matchScore > 0 && (
                            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold" style={{ background: `${scoreColor}14`, color: scoreColor }}>
                              {matchScore.toFixed(0)}% Match
                            </span>
                          )}
                        </div>
                        {/* Row 2: Job Title */}
                        <h4 className="text-[15.5px] font-bold text-slate-900 dark:text-white leading-snug">{n.title}</h4>
                        {/* Row 3: Location and Job Type */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400 dark:text-zinc-500 font-medium">
                          <div className="flex items-center gap-1">
                            <MapPin size={13} />
                            <span>{n.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Briefcase size={13} />
                            <span>{n.employment_type}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons on the right */}
                      <div className="flex items-center gap-2">
                        {/* Remove Bookmark (trash button) */}
                        <button
                          type="button"
                          onClick={() => toggleSaveJob(job)}
                          title="Remove bookmark"
                         className="cursor-pointer"
                          //  className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition active:scale-95 cursor-pointer shadow-xs"
                        >
                           <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Bookmark size={20} className="fill-[var(--accent)]" />
                </span>
                          {/* <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg> */}
                        </button>
                        {/* Apply Now / Applied Button */}
                        {isApplied ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 px-4 py-2 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ Applied
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApply(job)}
                            className="rounded-full bg-[var(--accent)] hover:opacity-90 text-white font-extrabold text-[12.5px] px-5 py-2 transition duration-155 active:scale-95 cursor-pointer shadow-xs"
                          >
                            Apply Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-[26px] border border-dashed py-14 text-center mt-4 bg-white/5 dark:bg-zinc-900/5" style={{ borderColor: "var(--surface-border)" }}>
                <Bookmark size={28} className="mb-3" style={{ color: "var(--fg-subtle)" }} />
                <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-150">No saved jobs yet</p>
                <p className="mt-1 text-[13px] text-slate-400">Click the bookmark icon on any job card to save it.</p>
                <button type="button" onClick={() => setActiveTab("applications")} className="mt-5 rounded-full px-6 py-2.5 text-[13px] font-extrabold text-white transition hover:opacity-90 cursor-pointer bg-black">
                  Browse Jobs
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: INTERVIEW PREP
        ══════════════════════════════════════════════ */}
        {hasResume && activeTab === "interview" && (() => {
          const allQuestions: Array<InterviewPrepItem & { skill: string }> = [];
          for (const skill of interviewSkillNames) {
            const items = interviewQuestionsBySkill[skill] || [];
            for (const item of items) {
              allQuestions.push({ ...item, skill });
            }
          }

          const filteredQuestions = allQuestions.filter((item) => {
            if (difficultyFilter === 'all') return true;
            const rank = normalizeInterviewPrepLevel(item.level || "");
            if (difficultyFilter === 'Basic') return rank === 0;
            if (difficultyFilter === 'Intermediate') return rank === 1;
            if (difficultyFilter === 'Coding') return rank === 3;
            return true;
          });

          const isGenerating = Object.values(interviewLoadingBySkill).some(Boolean);

          return (
            <div className="space-y-4">
              {/* Header card matching Screenshot 1 */}
              <div className="tal-card rounded-[26px] p-6 shadow-xs hover:shadow-lg transition-all duration-300">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">Interview Preparation</h3>
                    <p className="text-[13px] font-sans text-slate-500 dark:text-zinc-400 font-medium">Practice conceptual questions and coding exercises matching your parsed skill profiles.</p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => void loadInterviewPrepForAll("reload")}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white font-extrabold text-[12.5px] px-5 py-3 transition duration-150 active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} />
                      Generate Targeted Questions
                    </button>
                  </div>
                </div>
              </div>

              {/* Difficulty Level Tabs / Filters */}
              <div className="flex flex-wrap gap-2.5 pt-2">
                {(['all', 'Basic', 'Intermediate', 'Coding'] as const).map((level) => {
                  const isActive = difficultyFilter === level;
                  const label = level === 'all' ? 'All Difficulties' : level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficultyFilter(level)}
                      className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all duration-150 cursor-pointer ${
                        isActive
                          ? "bg-[var(--accent)] text-white shadow-xs"
                          : "bg-white/10 dark:bg-zinc-900/10 border border-slate-200/50 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-850"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Question list matching Screenshot 1 but answers directly visible */}
              {!allQuestions.length ? (
                <div className="flex flex-col items-center justify-center rounded-[26px] border border-dashed py-14 text-center bg-white/5 dark:bg-zinc-900/5" style={{ borderColor: "var(--surface-border)" }}>
                  <Brain size={28} className="mb-3 animate-pulse" style={{ color: "var(--fg-subtle)" }} />
                  <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-150">No interview prep loaded</p>
                  <p className="mt-1 text-[13px] text-slate-400">Click the button above to generate skill-based questions automatically.</p>
                </div>
              ) : filteredQuestions.length ? (
                <div className="space-y-4 mt-2">
                  {filteredQuestions.map((item, idx) => {
                    const level = formatInterviewPrepLevel(String(item.level || "Practice"));
                    const levelRank = normalizeInterviewPrepLevel(level);
                    const questionText = String(item.question || "No question provided.").trim();
                    const answerText = String(item.answer || item.tip || "").trim();
                    const isCoding = levelRank === 3;
                    const questionKey = `${item.skill}-${idx}`;

                    return (
                      <div
                        key={questionKey}
                        className="tal-card rounded-[26px] p-6 shadow-xs hover:shadow-lg transition-all duration-300 relative"
                      >
                        {/* Skill Badge top right */}
                        <span className="absolute right-6 top-6 rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent)]">
                          {item.skill}
                        </span>

                        {/* Top row with difficulty badge */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                            {level}
                          </span>
                        </div>

                        {/* Question Text with (?) icon */}
                        <div className="flex items-start gap-2.5 mb-2.5">
                          {/* <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-[12px] font-bold text-slate-500 dark:text-zinc-400 font-sans mt-0.5">
                            ?
                          </span> */}
                          <p className="text-[14.5px] font-bold leading-relaxed text-slate-900 dark:text-white font-display">
                            {questionText}
                          </p>
                        </div>

                        {/* Answer output (always visible directly) */}
                        {answerText && (
                          <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-zinc-800 font-sans">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)] mb-2">
                              Suggested Answer &amp; Solution:
                            </p>

                            {isCoding ? (
                              <pre className="overflow-x-auto rounded-xl bg-slate-900 dark:bg-[#0c0d0e] px-4 py-3 text-white font-mono whitespace-pre-wrap text-[12.5px] leading-relaxed">
                                {answerText}
                              </pre>
                            ) : (
                              <p className="text-[13px] leading-relaxed text-white whitespace-pre-wrap bg-slate-800 dark:bg-zinc-950 p-4 rounded-xl">
                                {answerText}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="tal-card rounded-[26px] py-12 text-center text-sm font-semibold" style={{ color: "var(--fg-muted)" }}>
                  No questions matching "{difficultyFilter}" difficulty found.
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Chat FAB ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {chatOpen && (
          <div className="flex flex-col w-[360px] max-h-[520px] rounded-3xl overflow-hidden shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}>
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: "var(--accent)" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white"><Bot size={17} /></div>
              <div>
                <p className="text-[13.5px] font-bold text-white leading-tight">NextRole Assistant</p>
                <p className="text-[11px] text-white/70 font-medium">Always here to help</p>
              </div>
              <button type="button" onClick={() => setChatOpen(false)} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-[340px]" style={{ background: "var(--surface-hover)" }}>
              {!chatHistoryLoaded ? (
                <div className="flex flex-col gap-2.5 pt-2">
                  {["80%","60%","75%"].map((w, i) => (
                    <div key={i} className={`flex items-end gap-2 ${i % 2 === 1 ? "justify-end" : "justify-start"}`}>
                      {i % 2 === 0 && <div className="h-6 w-6 rounded-full bg-slate-200 animate-pulse shrink-0" />}
                      <div className="h-9 rounded-2xl bg-slate-200 animate-pulse" style={{ width: w }} />
                    </div>
                  ))}
                </div>
              ) : chatMessages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "bot" && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white mb-0.5" style={{ background: "var(--accent)" }}>
                      <Bot size={12} />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm ${msg.role === "user" ? "text-white rounded-br-sm" : "rounded-bl-sm"}`} style={msg.role === "user" ? { background: "var(--accent)" } : { background: "var(--surface)", color: "var(--fg)", border: "1px solid var(--surface-border)" }}>
                    <p>{msg.text}</p>
                    {msg.tab && (
                      <button type="button" onClick={() => { setActiveTab(msg.tab!); setChatOpen(false); }} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        Go to {msg.tab} →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t px-4 py-3 flex items-center gap-2" style={{ borderColor: "var(--surface-border)", background: "var(--surface)" }}>
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }} placeholder="Ask anything..." className="flex-1 rounded-xl border px-3.5 py-2.5 text-[12.5px] outline-none transition" style={{ borderColor: "var(--surface-border)", background: "var(--surface-hover)", color: "var(--fg)" }} />
              <button type="button" onClick={sendChatMessage} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 active:scale-95" style={{ background: "var(--accent)" }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setChatOpen((p) => !p)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 active:scale-95"
          style={{ background: "var(--accent)" }}
          title="Help"
        >
          {chatOpen ? <X size={22} /> : <Bot size={24} />}
          {!chatOpen && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-extrabold text-white shadow">?</span>
          )}
        </button>
      </div>
    </SignalShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm font-semibold" style={{ color: "var(--fg-muted)" }}>Loading dashboard...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
