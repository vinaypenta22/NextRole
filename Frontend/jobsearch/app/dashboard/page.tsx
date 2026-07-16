"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Phone, MapPin, Clock, Upload, CheckCircle2, Briefcase, Globe, Zap, Lightbulb, FlaskConical, Brain, TrendingUp, Bookmark, BookmarkCheck, X, Send, Bot } from "lucide-react";
import SignalShell from "../components/SignalShell";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import PrimaryButton from "../components/PrimaryButton";
import {
  clearAuth,
  getAccessToken,
  getCurrentUser,
  getProfile,
  getResumeData,
  saveResumeData,
} from "../lib/auth";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}`;
const PAGE_SIZE = 5;

const defaultProfile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  bio: "",
};

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

type ResumeFieldItem = {
  label: string;
  value: string;
};

type InterviewPrepItem = {
  skill?: string;
  level?: string;
  question?: string;
  tip?: string;
  answer?: string;
};

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
  return {
    text: `${cleaned.slice(0, limit).trimEnd()}...`,
    truncated: true,
  };
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
    const bullets = Array.isArray(record.bullets)
      ? record.bullets.map((bullet) => String(bullet)).filter(Boolean)
      : [];

    if (!title && !subtitle && !details && !date && !bullets.length) continue;
    items.push({ title, subtitle, details, date, bullets });
  }
  return items;
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const items: string[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      const cleaned = item.trim();
      if (cleaned) items.push(cleaned);
      continue;
    }

    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const text = pickString(record, ["title", "name", "certification", "course", "label", "value", "details", "description"], "");
    if (text) items.push(text);
  }

  return items;
}

function normalizeInterviewPrepLevel(level: string) {
  const normalized = level.trim().toLowerCase();
  if (normalized.includes("basic") || normalized.includes("beginner")) return 0;
  if (normalized.includes("intermediate") || normalized.includes("mid")) return 1;
  if (normalized.includes("advanced") || normalized.includes("senior") || normalized.includes("expert")) return 2;
  if (normalized.includes("coding") || normalized.includes("code") || normalized.includes("challenge")) return 3;
  return 4;
}

function formatInterviewPrepLevel(level: string) {
  const cleaned = level.trim();
  return cleaned ? cleaned : "Practice";
}

function formatQuestionText(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "No question provided.";
  return cleaned;
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

  return {
    ...job,
    title,
    company,
    location,
    employment_type: employmentType,
    work_mode: workMode,
    experience,
    posted_at: postedAt,
    salary,
    description,
    apply_link: applyLink,
    url: applyLink,
    match_score: Number.isFinite(matchScore) ? matchScore : 0,
  };
}

function JobCard({
  job,
  isApplied = false,
  isSaved = false,
  onApply,
  onSave,
}: {
  job: Record<string, unknown>;
  isApplied?: boolean;
  isSaved?: boolean;
  onApply?: (job: Record<string, unknown>) => void;
  onSave?: (job: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalized = useMemo(() => normalizeJob(job), [job]);
  const summary = shortSummary(normalized.description || "No summary available.", 200);
  const matchScore = Math.max(0, Math.min(100, normalized.match_score));
  const scoreColor = matchScore >= 75 ? "text-emerald-600 bg-emerald-50" : matchScore >= 50 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-[#0052cc]/20">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ff] text-[#0052cc] font-bold text-sm">
              {String(normalized.company || "C").charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 className="text-[15px] font-semibold text-slate-800 leading-snug">{normalized.title}</h4>
              <p className="mt-0.5 text-[13px] text-slate-500">{normalized.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${scoreColor}`}>
              {matchScore.toFixed(0)}% match
            </span>
            <button
              type="button"
              onClick={() => onSave?.(job)}
              title={isSaved ? "Unsave job" : "Save job"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                isSaved ? "border-[#0052cc] bg-[#e8f0ff] text-[#0052cc]" : "border-slate-200 bg-white text-slate-400 hover:border-[#0052cc] hover:text-[#0052cc]"
              }`}
            >
              {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600">
            <Briefcase size={13} className="text-slate-400" />{normalized.employment_type}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600">
            <MapPin size={13} className="text-slate-400" />{normalized.location}
          </span>
          {normalized.salary ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600">
              <Zap size={13} className="text-slate-400" />{normalized.salary}
            </span>
          ) : null}
        </div>

        {normalized.description ? (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[12.5px] leading-relaxed text-slate-500">
              {expanded ? normalized.description : summary.text}
            </p>
            {summary.truncated ? (
              <button type="button" onClick={() => setExpanded((p) => !p)} className="mt-1.5 text-[12px] font-semibold text-[#0052cc] hover:underline">
                {expanded ? "Show less" : "Read more"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          {isApplied ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600">
              <CheckCircle2 size={14} /> Applied
            </span>
          ) : (
            <button type="button" onClick={() => onApply?.(job)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003fa3]">
              Apply Now
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const user = getCurrentUser();

  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    requestedTab === "profile" || requestedTab === "applications" || requestedTab === "applied" || requestedTab === "saved" || requestedTab === "interview"
      ? requestedTab
      : "profile",
  );
  
  const [resumeData, setResumeData] = useState<ResumeSnapshot | null>(null);
  const [profile, setProfile] = useState(defaultProfile);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [profileExists, setProfileExists] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [savedJobKeys, setSavedJobKeys] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "bot"; text: string; tab?: ActiveTab }[]>([
    { role: "bot", text: "Hi! I'm your JobSignal assistant 🤖 Ask me anything about using the platform." },
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const [savedJobs, setSavedJobs] = useState<Array<Record<string, unknown>>>([]);

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
    {patterns: ["hi","hello","hey","hii","hai","hiii","good morning","good afternoon","good evening", "greetings","yo","hola","how are you","what's up","sup"],answer:"Hello! 👋 Welcome to NextRole. I'm your AI career assistant. I can help you upload your resume, find matching jobs, improve your ATS score, prepare for interviews, manage saved and applied jobs, and answer any questions about the platform. How can I help you today?"},
    { patterns: ["upload", "resume", "cv", "pdf", "docx"], answer: "To upload your resume, go to the Applications tab. You'll find a file picker at the top — choose a PDF or DOCX file and click Upload Resume. The system will parse your skills and find matching jobs automatically.", tab: "applications" },
    { patterns: ["job", "find job", "search job", "match", "recommend"], answer: "Matched jobs are shown in the Applications tab after you upload your resume. You can filter by location, employment type, experience, and date posted.", tab: "applications" },
    { patterns: ["apply", "applied", "application"], answer: "Click Apply Now on any job card in the Applications tab. The job will be saved to your Applied tab and the company's application page will open in a new tab.", tab: "applied" },
    { patterns: ["save", "bookmark", "saved job"], answer: "Click the bookmark icon on any job card to save it. Saved jobs are stored in the database and visible in the Saved tab. Applying to a saved job removes it from saved automatically.", tab: "saved" },
    { patterns: ["ats", "score", "ats score", "resume score"], answer: "Your ATS score is shown in the Applications tab under ATS Resume Insights. It reflects how well your resume matches ATS filters. A score above 80 is excellent.", tab: "applications" },
    { patterns: ["interview", "question", "prep", "preparation"], answer: "Interview prep questions are in the Interview tab. They are grouped by skill and include Basic, Intermediate, Advanced, and Coding levels — all generated from your resume.", tab: "interview" },
    { patterns: ["profile", "skills", "education", "project"], answer: "Your parsed profile is in the Profile tab. It shows your skills, education, projects, certifications, and contact info extracted from your resume.", tab: "profile" },
    { patterns: ["logout", "sign out", "log out"], answer: "Click the Logout button in the top navigation bar to sign out of your account." },
    { patterns: ["tab", "navigate", "navigation", "where"], answer: "Use the tabs at the top: Profile (your parsed info), Applications (jobs + ATS), Applied (jobs you applied to), Saved (bookmarked jobs), Interview (prep questions)." },
    { patterns: ["improvement", "suggestion", "improve resume"], answer: "Resume improvement suggestions are shown in the Applications tab under ATS Resume Insights on the right side. They are AI-generated tips specific to your resume.", tab: "applications" },
  ];

  function getBotReply(input: string): { text: string; tab?: ActiveTab } {
    const lower = input.toLowerCase();
    for (const qa of HELP_QA) {
      if (qa.patterns.some((p) => lower.includes(p))) {
        return { text: qa.answer, tab: qa.tab };
      }
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
        body: JSON.stringify({
          user_id: user.id,
          messages: [
            { role: "user", text: trimmed },
            { role: "bot", text: reply.text, tab: reply.tab ?? "" },
          ],
        }),
      });
    }
  }
  
  useEffect(() => {
    if (!chatOpen || chatHistoryLoaded || !user?.id) return;
    const currentUserId = user.id;
    async function loadChatHistory() {
      try {
        const response = await fetch(`${API_BASE}/chat/?user_id=${currentUserId}`, {
          headers: { Authorization: `${getAccessToken()}` },
        });
        const payload = await response.json();
        if (response.ok && Array.isArray(payload.results) && payload.results.length > 0) {
          const history = payload.results.map((m: { role: string; text: string; tab?: string }) => ({
            role: m.role as "user" | "bot",
            text: m.text,
            tab: (m.tab || undefined) as ActiveTab | undefined,
          }));
          setChatMessages(history);
        }
      } catch { /* keep default greeting */ }
      setChatHistoryLoaded(true);
    }
    void loadChatHistory();
  }, [chatOpen, chatHistoryLoaded, user?.id]);

  const [filters, setFilters] = useState<JobSearchFilters>({
    location: "all",
    employmentType: "all",
    experience: "any",
    posted: "any",
  });
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [collapsedSkills, setCollapsedSkills] = useState<Record<string, boolean>>({});
  
  const hasResume = Boolean(
    resumeData?.is_resume_uploaded ||
      (resumeData?.resume_details && Object.keys(resumeData.resume_details).length > 0)
  );
  
  const hasCustomFilters = useMemo(() => {
    return filters.location !== "all" || filters.employmentType !== "all" || filters.experience !== "any" || filters.posted !== "any";
  }, [filters]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const cachedProfile = getProfile();
    const hasCachedProfile = Boolean(cachedProfile);
    setProfileExists(hasCachedProfile);
    if (cachedProfile) {
      setProfile({ ...defaultProfile, ...cachedProfile });
    }

    const cachedResume = getResumeData() as ResumeSnapshot | null;
    if (cachedResume) {
      setResumeData(cachedResume);
      const normalizedJobs = (cachedResume.recommended_jobs ?? []).map((job) => normalizeJob(job));
      setJobs(normalizedJobs);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!user?.id || resumeData) return;

    const currentUserId = user.id;
    let cancelled = false;

    async function restoreRecommendations() {
      try {
        const response = await fetch(`${API_BASE}/search-jobs/?user_id=${currentUserId}`, {
          headers: {
            Authorization: `${getAccessToken()}`,
          },
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to restore recommendations.");
        }

        const restoredJobs = Array.isArray(payload.recommended_jobs) ? payload.recommended_jobs : [];
        const nextResume: ResumeSnapshot = {
          is_resume_uploaded: Boolean(payload.is_resume_uploaded),
          resume_details: payload.resume_details || {},
          recommended_jobs: restoredJobs,
          resume_insights: payload.resume_insights || {},
        };

        if (!cancelled && nextResume.is_resume_uploaded) {
          setResumeData(nextResume);
          saveResumeData(nextResume);
          setJobs(restoredJobs.map((job: Record<string, unknown>) => normalizeJob(job)));
        } else if (!cancelled) {
          setResumeData(null);
          setJobs([]);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
        }
      }
    }

    void restoreRecommendations();

    return () => {
      cancelled = true;
    };
  }, [resumeData, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;
    async function loadAppliedJobs() {
      try {
        const response = await fetch(`${API_BASE}/applied/?user_id=${currentUserId}`, {
          headers: { Authorization: `${getAccessToken()}` },
        });
        const payload = await response.json();
        if (response.ok) setAppliedJobs(Array.isArray(payload.results) ? (payload.results as AppliedJob[]) : []);
      } catch { /* keep existing */ }
    }
    void loadAppliedJobs();
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const currentUserId = user.id;
    async function loadSavedJobs() {
      try {
        const response = await fetch(`${API_BASE}/saved-jobs/?user_id=${currentUserId}`, {
          headers: { Authorization: `${getAccessToken()}` },
        });
        const payload = await response.json();
        if (response.ok && Array.isArray(payload.results)) {
          const jobs = payload.results as Array<Record<string, unknown>>;
          setSavedJobs(jobs);
          setSavedJobKeys(new Set(jobs.map((j) => getJobKey(j))));
        }
      } catch { /* keep existing */ }
    }
    void loadSavedJobs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== "applications") return;

    let cancelled = false;

    async function loadRecommendations() {
      try {
        const currentResume = resumeData || getResumeData() || null;
        if (!currentResume?.resume_details || !user?.id) return;

        if (!hasCustomFilters && Array.isArray(currentResume.recommended_jobs) && currentResume.recommended_jobs.length > 0) {
          setJobs((currentResume.recommended_jobs as Record<string, unknown>[]).map((job) => normalizeJob(job)));
          setSearching(false);
          return;
        }

        setSearching(true);
        const response = await fetch(`${API_BASE}/search-jobs/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `${getAccessToken()}`,
          },
          body: JSON.stringify({
            user_id: user?.id,
            resume_details: currentResume.resume_details || {},
            filters: {
              location: filters.location,
              employment_type: filters.employmentType,
              experience: filters.experience,
              posted: filters.posted,
              num_pages: 20,
            },
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Unable to load recommendations.");
        }

        const recommendedJobs = Array.isArray(payload.recommended_jobs) ? payload.recommended_jobs : [];
        const resumeInsights = payload.resume_insights || currentResume.resume_insights || {};
        if (!cancelled) {
          setJobs(recommendedJobs.map((job: Record<string, unknown>) => normalizeJob(job)));
          const nextResume = {
            ...(currentResume || {}),
            resume_details: payload.resume_details || currentResume.resume_details || {},
            recommended_jobs: recommendedJobs,
            resume_insights: resumeInsights,
          };
          setResumeData(nextResume);
          saveResumeData(nextResume);
          setPage(1);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load recommendations.");
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [activeTab, hasCustomFilters, filters.location, filters.employmentType, filters.experience, filters.posted, user?.id]);

  const stats = useMemo(() => {
    const resumeCount = resumeData ? 1 : 0;
    return [
      { label: "Resume Status", value: resumeCount ? "Uploaded" : "Pending", tone: "sky" as const },
      { label: "Suggested Jobs", value: `${jobs.length}`, tone: "emerald" as const },
      { label: "Applied Jobs", value: `${appliedJobs.length}`, tone: "violet" as const },
    ];
  }, [appliedJobs.length, jobs.length, resumeData]);

  const resumeInsights = useMemo(() => {
    return (resumeData?.resume_insights as Record<string, unknown> | undefined) || {};
  }, [resumeData]);

  const atsScore = Number(resumeInsights.ats_resume_score ?? 0);

  const resumeImprovementSuggestions = useMemo(() => {
    const raw = resumeInsights.resume_improvement_suggestions;
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => String(s)).filter(Boolean);
  }, [resumeInsights]);
  
  const interviewPrep = useMemo(
    () =>
      Array.isArray(resumeInsights.ai_interview_preparation)
        ? (resumeInsights.ai_interview_preparation.filter(
            (item): item is InterviewPrepItem => typeof item === "object" && item !== null,
          ) as InterviewPrepItem[])
        : [],
    [resumeInsights],
  );

  const groupedInterviewPrep = useMemo(() => {
    const grouped = new Map<string, InterviewPrepItem[]>();

    for (const item of interviewPrep) {
      const skill = String(item.skill || "Other skills").trim() || "Other skills";
      const currentItems = grouped.get(skill) || [];
      currentItems.push(item);
      grouped.set(skill, currentItems);
    }

    return Array.from(grouped.entries()).map(([skill, items]) => ({
      skill,
      items: items
        .slice()
        .sort((left, right) => normalizeInterviewPrepLevel(String(left.level || "")) - normalizeInterviewPrepLevel(String(right.level || ""))),
    }));
  }, [interviewPrep]);

  function toggleSkillCollapse(skill: string) {
    setCollapsedSkills((prev) => ({
      ...prev,
      [skill]: !prev[skill],
    }));
  }

  const interviewPrepView = (
    <div className="space-y-4">
      {groupedInterviewPrep.length ? (
        groupedInterviewPrep.map((group) => (
          <div key={group.skill} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSkillCollapse(group.skill)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f0ff] text-[#0052cc]">
                  <Brain size={16} />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-slate-800">{group.skill}</h4>
                  <p className="text-[12px] text-slate-400">{group.items.length} question{group.items.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                collapsedSkills[group.skill] ? "bg-slate-100 text-slate-500" : "bg-[#e8f0ff] text-[#0052cc]"
              }`}>
                {collapsedSkills[group.skill] ? "Show" : "Hide"}
              </span>
            </button>

            {!collapsedSkills[group.skill] ? (
              <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                {group.items.map((item, idx) => {
                  const level = formatInterviewPrepLevel(String(item.level || "Practice"));
                  const levelRank = normalizeInterviewPrepLevel(level);
                  const questionText = formatQuestionText(String(item.question || ""));
                  const answerText = String(item.answer || item.tip || "").trim();

                  const isCoding = levelRank === 3;

                  let badgeClass = "bg-blue-50 text-blue-600";
                  let barClass = "bg-[#0052cc]";
                  let progressPct = 25;
                  if (levelRank === 3) { badgeClass = "bg-purple-50 text-purple-600"; barClass = "bg-purple-500"; progressPct = 100; }
                  else if (levelRank === 2) { badgeClass = "bg-emerald-50 text-emerald-600"; barClass = "bg-emerald-500"; progressPct = 75; }
                  else if (levelRank === 1) { badgeClass = "bg-amber-50 text-amber-600"; barClass = "bg-amber-400"; progressPct = 50; }

                  return (
                    <div key={`${group.skill}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}>{level}</span>
                        {isCoding ? <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Code Challenge</span> : <Lightbulb size={14} className="text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[13px] font-semibold text-slate-700 leading-relaxed mb-2">{questionText}</p>
                      {isCoding ? (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-[12px] leading-relaxed text-emerald-300 font-mono whitespace-pre-wrap">{answerText || "No solution available."}</pre>
                      ) : (
                        <div className="text-[12.5px] text-slate-600 leading-relaxed whitespace-pre-wrap font-mono bg-slate-100 rounded-lg px-3 py-2.5 mt-1">
                          <span className="font-semibold not-italic font-sans text-slate-700 block mb-1">Answer:</span>{answerText || "No answer available."}
                        </div>
                      )}
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0ff] text-[#0052cc] mb-4">
            <Brain size={24} />
          </div>
          <p className="text-[14px] font-semibold text-slate-600">No interview prep yet</p>
          <p className="mt-1 text-[13px] text-slate-400">Upload your resume to generate skill-based questions.</p>
        </div>
      )}
    </div>
  );

  const displayName = profile.name || String(resumeData?.resume_details?.name || user?.name || "");
  const displayRole = String(resumeData?.resume_details?.current_designation || "");
  const displayCompany = String(resumeData?.resume_details?.current_company || "");
  const displayEmail = String(resumeData?.resume_details?.email || profile.email || user?.email || "");
  const displayPhone = String(resumeData?.resume_details?.phone || profile.phone || "");
  const displayLocation = String(resumeData?.resume_details?.location || profile.location || "");
  const displayExperience = String(resumeData?.resume_details?.experience_years ?? "");
  const displayLinkedIn = String(resumeData?.resume_details?.linkedin || "");
  const displayGitHub = String(resumeData?.resume_details?.github || "");
  const displayBio = String(resumeData?.resume_details?.summary || resumeData?.resume_details?.bio || profile.bio || "");

  const skills = useMemo(() => {
    const parsedSkills = Array.isArray(resumeData?.resume_details?.skills)
      ? (resumeData?.resume_details?.skills as unknown[]).map((skill) => String(skill)).filter(Boolean)
      : [];
    return parsedSkills;
  }, [resumeData]);

  const educationItems = useMemo(
    () => normalizeParsedItems(resumeData?.resume_details?.education),
    [resumeData],
  );

  const projectItems = useMemo(
    () => normalizeParsedItems(resumeData?.resume_details?.projects),
    [resumeData],
  );

  const certificationItems = useMemo(
    () => normalizeTextList(resumeData?.resume_details?.certifications),
    [resumeData],
  );

  const resumeFieldItems = useMemo<ResumeFieldItem[]>(
    () => [
      { label: "Full name", value: displayName || "Not parsed" },
      { label: "Email", value: displayEmail || "Not parsed" },
      { label: "Phone", value: displayPhone || "Not parsed" },
      { label: "Location", value: displayLocation || "Not parsed" },
      { label: "Current role", value: displayRole || "Not parsed" },
      { label: "Current company", value: displayCompany || "Not parsed" },
      { label: "Experience", value: displayExperience ? `${displayExperience} year${Number(displayExperience) === 1 ? "" : "s"}` : "Not parsed" },
      { label: "LinkedIn", value: displayLinkedIn || "Not parsed" },
      { label: "GitHub", value: displayGitHub || "Not parsed" },
      { label: "Resume summary", value: displayBio || "Not parsed" },
    ],
    [displayBio, displayCompany, displayEmail, displayExperience, displayGitHub, displayLinkedIn, displayLocation, displayName, displayPhone, displayRole],
  );

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
      const response = await fetch(`${API_BASE}/applied/?user_id=${user.id}`, {
        headers: {
          Authorization: `${getAccessToken()}`,
        },
      });
      const payload = await response.json();
      if (response.ok && Array.isArray(payload.results)) {
        setAppliedJobs(payload.results as AppliedJob[]);
      }
    } catch {
      // Keep existing state if the refresh fails.
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedFile || !user?.id) {
      setError("Please choose a resume file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", selectedFile);
    formData.append("user_id", String(user.id));

    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;
    let t4: ReturnType<typeof setTimeout> | undefined;
    let t5: ReturnType<typeof setTimeout> | undefined;
    try {
      setUploading(true);
      setUploadStep(1);
      t2 = setTimeout(() => setUploadStep(2), 4000);
      t3 = setTimeout(() => setUploadStep(3), 9000);
      t4 = setTimeout(() => setUploadStep(4), 15000);
      t5 = setTimeout(() => setUploadStep(5), 22000);
      const response = await fetch(`${API_BASE}/upload/`, {
        method: "POST",
        headers: {
          Authorization: `${getAccessToken()}`,
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Resume upload failed.");
      }

      const nextResume: ResumeSnapshot = {
        resume_id: payload.resume_id,
        message: payload.message,
        is_resume_uploaded: Boolean(payload.is_resume_uploaded),
        resume_details: payload.resume_details,
        recommended_jobs: payload.recommended_jobs,
        resume_insights: payload.resume_insights,
      };

      setResumeData(nextResume);
      saveResumeData(nextResume);
      if (Array.isArray(payload.recommended_jobs)) {
        setJobs((payload.recommended_jobs as Record<string, unknown>[]).map((job) => normalizeJob(job)));
      } else {
        setJobs([]);
      }
      setSelectedFile(null);
      setActiveTab("applications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
      setUploading(false);
      setUploadStep(0);
    }
  }

  async function handleApply(job: Record<string, unknown>) {
    if (!user?.id) return;
    const normalized = normalizeJob(job);

    try {
      const response = await fetch(`${API_BASE}/applied/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${getAccessToken()}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          job: normalized,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Unable to save applied job.");
      }

      // Remove from saved jobs if it was saved
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
      if (normalized.apply_link) {
        window.open(normalized.apply_link, "_blank", "noopener,noreferrer");
      }
      setSuccess("Application saved and the external parsing has been opened.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save applied job.");
      setTimeout(() => setError(null), 4000);
    }
  }

  function handleLogout() {
    clearAuth();
    router.replace("/login");
  }

  const initials = useMemo(() => {
    return displayName
      .split(" ")
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "VP";
  }, [displayName]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[14px] font-semibold text-slate-400">
        Loading dashboard...
      </div>
    );
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_60px_rgba(0,82,204,0.10)]">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f0ff] text-3xl mb-4">
              {uploadSteps[(uploadStep || 1) - 1]?.icon}
            </div>
            <h2 className="text-[18px] font-bold text-slate-800">Analyzing your resume</h2>
            <p className="mt-1 text-[13px] text-slate-400">This takes about 30–60 seconds. Please wait.</p>
          </div>
          <div className="space-y-3">
            {uploadSteps.map((step, idx) => {
              const stepNum = idx + 1;
              const isDone = uploadStep > stepNum;
              const isActive = uploadStep === stepNum;
              return (
                <div key={step.label} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
                  isDone ? "bg-emerald-50 border border-emerald-100" :
                  isActive ? "bg-[#e8f0ff] border border-[#c0d4f5]" :
                  "bg-slate-50 border border-slate-100 opacity-40"
                }`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                    isDone ? "bg-emerald-500 text-white" :
                    isActive ? "bg-[#0052cc] text-white" :
                    "bg-slate-200 text-slate-400"
                  }`}>
                    {isDone ? "✓" : stepNum}
                  </div>
                  <span className={`text-[13.5px] font-semibold ${
                    isDone ? "text-emerald-700" : isActive ? "text-[#0052cc]" : "text-slate-400"
                  }`}>{step.label}</span>
                  {isActive ? (
                    <span className="ml-auto flex gap-1">
                      {[0,1,2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#0052cc] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0052cc] to-[#00a8e8] transition-all duration-700 ease-out"
              style={{ width: `${((uploadStep || 1) / uploadSteps.length) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Step {uploadStep || 1} of {uploadSteps.length}
          </p>
        </div>
      </div>
    );
  }

  return (
    <SignalShell activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} savedCount={savedJobs.length}>
      <div className="space-y-6">
        
        {activeTab !== "profile" ? (
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((item) => (
              <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </div>
        ) : null}

        {/* IF RESUME IS NOT YET UPLOADED, SHOW WELCOME BANNER & INITIAL UPLOAD WIDGET */}
        {!hasResume ? (
          <SectionCard title="Upload your resume" description="Add a resume to unlock your profile snapshot, matched jobs, and applied job tracking.">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] mt-4">
              <form onSubmit={handleUpload} className="space-y-4">
                <label className="flex min-h-[170px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/20 px-5 py-6 text-center text-sm text-slate-500 hover:bg-slate-50 transition duration-150">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#0052cc] shadow-sm">
                    <Upload className="h-5.5 w-5.5" />
                  </span>
                  <span className="text-[14.5px] font-bold text-slate-700">Drop your PDF or DOCX resume here</span>
                  <span className="text-[12px] text-slate-400 font-medium">Once uploaded, we&apos;ll generate your query and fetch job matches automatically.</span>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    className="max-w-[240px] text-[12px]"
                  />
                </label>
                <PrimaryButton type="submit" isLoading={uploading} className="w-full py-3.5">
                  Upload resume
                </PrimaryButton>
                {error ? <p className="rounded-xl bg-rose-50 px-4 py-3.5 text-xs font-semibold text-rose-600">{error}</p> : null}
                {success ? <p className="rounded-xl bg-emerald-50 px-4 py-3.5 text-xs font-semibold text-emerald-700">{success}</p> : null}
              </form>

              <div className="rounded-xl border border-slate-100 bg-slate-50/10 p-5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">What you&apos;ll get</p>
                <div className="mt-4 space-y-3.5">
                  {[
                    "Resume-driven job query built from your current role and location.",
                    "Fresh recommendations fetched from the API using num_pages for more results.",
                    "Applied jobs saved in the database and visible in the Applied tab.",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3.5">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                      <p className="text-[12.5px] leading-relaxed text-slate-500 font-medium">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {hasResume && activeTab === "profile" ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[28px] border border-[#e6ebf5] bg-white p-6 shadow-[0_20px_45px_rgba(79,86,232,0.06)] md:p-7 h-fit">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0052cc_0%,#00a8e8_100%)] text-[28px] font-bold text-white shadow-[0_12px_30px_rgba(0,82,204,0.25)]">
                  {initials}
                </div>

                <div className="mt-5">
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#1f2430]">{displayName || "Your Name"}</h2>
                  <p className="mt-1 text-[13px] font-medium text-[#0052cc]">{displayRole || "Designation"}</p>
                  <p className="mt-1 text-[13px] text-[#596377]">{displayCompany || "Company name"}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-[#edf1f7] pt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">Email</p>
                    <p className="font-semibold text-[#1f2430]">{displayEmail}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">Phone</p>
                    <p className="font-semibold text-[#1f2430]">{displayPhone || "Not added"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">Location</p>
                    <p className="font-semibold text-[#1f2430]">{displayLocation || "Not added"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Briefcase className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">Current company</p>
                    <p className="font-semibold text-[#1f2430]">{displayCompany || "-"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FlaskConical  className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">Experience</p>
                    <p className="font-semibold text-[#1f2430]">{displayExperience ? `${displayExperience} yr${Number(displayExperience) === 1 ? "" : "s"}` : "Not parsed"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">Linkedin</p>
                    <p className="font-semibold text-[#1f2430]">{displayLinkedIn || "-"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">GitHub</p>
                    <p className="font-semibold text-[#1f2430]">{displayGitHub || "-"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="mt-0.5 h-4 w-4 text-[#7b8498]" />
                  <div>
                    <p className="text-[12px] text-[#7b8498]">Skills Identified</p>
                    <p className="font-semibold text-[#1f2430]">{skills.length || 0}</p>
                  </div>
                </div>
              </div>

            </section>

            <div className="space-y-6">
              <SectionCard title="Technical Skills">
                <div className="flex flex-wrap gap-2">
                  {skills.length ? (
                    skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#f4f6fb] px-4 py-2 text-[13px] font-medium text-[#44506a]"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-[#7b8498]">No skills parsed yet.</span>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Education">
                {educationItems.length ? (
                  <div className="space-y-4">
                    {educationItems.map((item, index) => (
                      <div key={`${item.title || index}`} className="space-y-1">
                        <h4 className="text-[15px] font-medium tracking-[-0.01em] text-[#1f2430]">
                          {item.title || "Education"}
                        </h4>
                        {item.subtitle ? <p className="text-[13px] text-[#596377]">{item.subtitle}</p> : null}
                        {item.date ? (
                          <div className="flex items-center gap-1.5 text-[13px] text-[#596377]">
                            <Clock size={15} className="text-[#7b8498]" />
                            <span>{item.date}</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] text-[#7b8498]">No education details parsed yet.</div>
                )}
              </SectionCard>

              <SectionCard title="Projects">
                {projectItems.length ? (
                  <div className="space-y-3">
                    {projectItems.map((item, index) => (
                      <article key={`${item.title || index}`} className="rounded-[14px] border border-[#edf1f7] bg-[#fafbfe] p-4">
                        <h4 className="text-[15px] font-medium tracking-[-0.01em] text-[#1f2430]">{item.title || "Project"}</h4>
                        {item.subtitle ? <p className="mt-1 text-[13px] text-[#596377]">{item.subtitle}</p> : null}
                        {item.details ? <p className="mt-2 text-[13px] leading-6 text-[#5b657d]">{item.details}</p> : null}
                        {item.bullets?.length ? (
                          <ul className="mt-3 space-y-2">
                            {item.bullets.map((bullet, bulletIndex) => (
                              <li key={`${bullet}-${bulletIndex}`} className="flex items-start gap-2 text-[13px] leading-6 text-[#5b657d]">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0052cc]" />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] text-[#7b8498]">No project details parsed yet.</div>
                )}
              </SectionCard>

              <SectionCard title="Certifications">
                {certificationItems.length ? (
                  <div className="flex flex-wrap gap-2">
                    {certificationItems.map((certification) => (
                      <span
                        key={certification}
                        className="rounded-full border border-[#e6ebf5] bg-[#fafbfe] px-4 py-2 text-[13px] font-medium text-[#44506a]"
                      >
                        {certification}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] text-[#7b8498]">No certifications parsed yet.</div>
                )}
              </SectionCard>
            </div>
          </div>
        ) : null}

        {/* TAB 2: APPLICATIONS & JOBS VIEW */}
        {hasResume && activeTab === "applications" ? (
          <div className="space-y-6">
            
            {/* Resume Manager Card */}
            <SectionCard title="Resume Manager" description="Upload a new PDF or DOCX file and let the system analyze it.">
              <div className="mt-4">
                <form onSubmit={handleUpload} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-h-[66px] flex-1 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/30 px-4 py-3.5 text-sm text-slate-500 hover:bg-slate-50 transition duration-150">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0052cc] shadow-sm">
                      <Upload className="h-5 w-5" />
                    </span>
                    <span className="flex flex-col text-left">
                      <span className="text-[13.5px] font-bold text-slate-700">Choose a PDF or DOCX file</span>
                      <span className="text-[12px] text-slate-400 font-medium">Max file size: 10 MB</span>
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      className="ml-auto max-w-[170px] text-[12px]"
                    />
                  </label>
                  <PrimaryButton type="submit" isLoading={uploading} className="h-[52px] px-7 sm:w-auto w-full">
                    Upload resume
                  </PrimaryButton>
                </form>
                
                {error ? (
                  <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3.5 text-xs font-semibold text-rose-600">{error}</p>
                ) : null}
                
                {success ? (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                    <span>{success}</span>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {/* ATS Resume Insights Card */}
            <SectionCard title="ATS Resume Insights" description="AI-powered score and suggestions based on your parsed profile.">
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] mt-4">
                
                {/* Left circular gauge */}
                <div className="flex flex-col items-center justify-center text-center p-6 border border-slate-100 rounded-2xl bg-slate-50/10">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-36 h-36" viewBox="0 0 120 120">
                      {/* Gray track circle */}
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                      {/* Gradient progress circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="url(#atsGaugeGradient)"
                        strokeWidth="10"
                        strokeDasharray="314"
                        strokeDashoffset={314 - (314 * Math.max(0, Math.min(100, atsScore || 78))) / 100}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="atsGaugeGradient" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#0052cc" />
                          <stop offset="100%" stopColor="#00a8e8" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-[34px] font-black text-slate-800 leading-none">{atsScore || 78}</span>
                      <span className="text-[8.5px] font-extrabold uppercase tracking-[0.1em] text-slate-400 mt-1">ATS Score</span>
                    </div>
                  </div>
                  <p className="mt-4 text-[13.5px] font-bold text-slate-600 px-2 leading-snug">
                    {atsScore >= 80
                      ? "Your resume is in excellent condition for ATS systems"
                      : atsScore >= 50
                      ? "Your resume is in good condition, but has room for improvement."
                      : "Your resume needs significant improvements to pass ATS filters."}
                  </p>
                </div>

                {/* Right: Resume Improvement Suggestions from API */}
                <div className="flex flex-col gap-2.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Improvement Suggestions</p>
                  {resumeImprovementSuggestions.length ? (
                    resumeImprovementSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
                        <TrendingUp size={15} className="mt-0.5 shrink-0 text-amber-500" />
                        <p className="text-[12.5px] font-medium text-amber-800 leading-relaxed">{suggestion}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
                      <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-[13px] font-bold text-emerald-700">Your resume looks great!</p>
                        <p className="text-[11.5px] text-emerald-500 mt-0.5">No improvement suggestions from the AI. Keep it updated as you grow.</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </SectionCard>

            {/* Matched to your resume Card */}
            <SectionCard title="Matched to your resume" description="Jobs are sorted by your parsed resume data.">
              
              {/* Filter bar */}
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between rounded-xl bg-slate-50 p-4.5 border border-slate-100/50 mt-4">
                <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4 flex-1">
                  <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>Job Location</span>
                    <input
                      value={filters.location}
                      onChange={(event) => updateFilter("location", event.target.value)}
                      placeholder="Filter by location"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0052cc] focus:ring-4 focus:ring-blue-100/50"
                    />
                  </label>
                  
                  <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>Job Employment Type</span>
                    <select
                      value={filters.employmentType}
                      onChange={(event) => updateFilter("employmentType", event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0052cc] focus:ring-4 focus:ring-blue-100/50"
                    >
                      <option value="all">All types</option>
                      <option value="Full-Time">Full-Time</option>
                      <option value="Part-Time">Part-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </label>
                  
                  <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>Experience</span>
                    <select
                      value={filters.experience}
                      onChange={(event) => updateFilter("experience", event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0052cc] focus:ring-4 focus:ring-blue-100/50"
                    >
                      <option value="any">Any experience</option>
                      <option value="0-2">0 - 2 years</option>
                      <option value="3-5">3 - 5 years</option>
                      <option value="5+">5+ years</option>
                    </select>
                  </label>
                  
                  <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>Date Posted</span>
                    <select
                      value={filters.posted}
                      onChange={(event) => updateFilter("posted", event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0052cc] focus:ring-4 focus:ring-blue-100/50"
                    >
                      <option value="any">Any time</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="older">Older</option>
                    </select>
                  </label>
                </div>

                <div className="shrink-0 text-sm font-bold text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200/50">
                  {searching ? "Refreshing..." : `${jobs.length} results`}
                </div>
              </div>

              {/* Job List Container */}
              <div className="space-y-4">
                {pagedJobs.length ? (
                  pagedJobs.map((job, index) => {
                    const normalized = normalizeJob(job);
                    const isApplied = appliedJobs.some((app) => app.title === normalized.title && app.company === normalized.company);
                    return (
                      <JobCard
                        key={`${normalized.title}-${index}`}
                        job={job}
                        isApplied={isApplied}
                        isSaved={savedJobKeys.has(getJobKey(job))}
                        onApply={handleApply}
                        onSave={toggleSaveJob}
                      />
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/20 p-8 text-center text-sm font-semibold text-slate-400">
                    {searching
                      ? "Refreshing job recommendations..."
                      : "Upload a resume to populate matched roles here."}
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                <p className="text-[12.5px] font-bold text-slate-400">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#003fa3] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Saved Jobs */}
            {savedJobs.length > 0 ? (
              <SectionCard title="Saved jobs" description="Jobs you bookmarked — apply to remove them from saved.">
                <div className="space-y-4 mt-4">
                  {savedJobs.map((job, idx) => {
                    const n = normalizeJob(job);
                    const isApplied = appliedJobs.some((a) => a.title === n.title && a.company === n.company);
                    return (
                      <JobCard
                        key={`saved-${n.apply_link || idx}`}
                        job={job}
                        isApplied={isApplied}
                        isSaved={true}
                        onApply={handleApply}
                        onSave={toggleSaveJob}
                      />
                    );
                  })}
                </div>
              </SectionCard>
            ) : null}
          </div>
        ) : null}

        {/* TAB 3: APPLIED JOBS */}
        {hasResume && activeTab === "applied" ? (
          <div className="space-y-6">
            <SectionCard title="Applied jobs" description="Jobs you have already applied to are stored in the database.">
              <div className="space-y-4 mt-4">
                {appliedJobs.length ? (
                  appliedJobs.map((job) => {
                    const jobWithScore = { ...job, match_score: job.match_score ?? 0 };
                    return (
                      <div key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ff] text-[#0052cc] font-bold text-sm">
                              {String(job.company || "C").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-[15px] font-semibold text-slate-800 leading-snug">{job.title}</h4>
                              <p className="mt-0.5 text-[13px] text-slate-500">{job.company}</p>
                            </div>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 size={12} /> Applied
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600">
                            <Briefcase size={13} className="text-slate-400" />{job.employment_type || "Full-Time"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600">
                            <MapPin size={13} className="text-slate-400" />{job.location || "Remote"}
                          </span>
                          {job.match_score > 0 ? (
                            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold ${
                              job.match_score >= 75 ? "text-emerald-600 bg-emerald-50" : job.match_score >= 50 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50"
                            }`}>
                              <Zap size={13} />{job.match_score.toFixed(0)}% match
                            </span>
                          ) : null}
                          {job.applied_at ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] text-slate-500">
                              <Clock size={13} className="text-slate-400" />Applied {new Date(job.applied_at).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                        {job.description ? (
                          <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500 border-t border-slate-100 pt-3 line-clamp-2">{job.description}</p>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/20 p-8 text-center text-sm font-semibold text-slate-400">
                    No applied jobs yet. Apply to a role from the matched jobs list to store it here.
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Quick links" description="Jump back to the matching flow.">
              <div className="flex flex-wrap gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("applications")}
                  className="rounded-lg bg-slate-800 hover:bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition"
                >
                  Back to jobs
                </button>
                <Link href="/profile" className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
                  Edit account
                </Link>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {hasResume && activeTab === "saved" ? (
          <div className="space-y-6">
            <SectionCard
              title="Saved jobs"
              description={savedJobs.length ? `${savedJobs.length} job${savedJobs.length === 1 ? "" : "s"} bookmarked — apply to remove from saved.` : "Bookmark jobs from the Applications tab to see them here."}
            >
              <div className="space-y-4 mt-4">
                {savedJobs.length ? (
                  savedJobs.map((job, idx) => {
                    const n = normalizeJob(job);
                    const isApplied = appliedJobs.some((a) => a.title === n.title && a.company === n.company);
                    return (
                      <JobCard
                        key={`saved-tab-${n.apply_link || idx}`}
                        job={job}
                        isApplied={isApplied}
                        isSaved={true}
                        onApply={handleApply}
                        onSave={toggleSaveJob}
                      />
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-14 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0ff] text-[#0052cc] mb-4">
                      <Bookmark size={24} />
                    </div>
                    <p className="text-[14px] font-semibold text-slate-600">No saved jobs yet</p>
                    <p className="mt-1 text-[13px] text-slate-400">Click the bookmark icon on any job card to save it here.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("applications")}
                      className="mt-5 rounded-lg bg-[#0052cc] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#003fa3]"
                    >
                      Browse jobs
                    </button>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {hasResume && activeTab === "interview" ? (
          <div className="space-y-6">
            {interviewPrepView}
          </div>
        ) : null}

      </div>

      {/* ── Help Chatbot FAB ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {chatOpen ? (
          <div className="flex flex-col w-[360px] max-h-[520px] rounded-3xl border border-slate-200/80 bg-white shadow-[0_32px_80px_rgba(0,0,0,0.18)] overflow-hidden">
            {/* Header */}
            <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#0052cc] to-[#0073e6] px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-white leading-tight">JobSignal Assistant</p>
                <p className="text-[11px] text-blue-200 font-medium">Always here to help</p>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 max-h-[340px] bg-slate-50/60">
              {!chatHistoryLoaded ? (
                <div className="flex flex-col gap-2.5 pt-2">
                  {["80%", "60%", "75%"].map((w, i) => (
                    <div key={i} className={`flex items-end gap-2 ${i % 2 === 1 ? "justify-end" : "justify-start"}`}>
                      {i % 2 === 0 && <div className="h-6 w-6 rounded-full bg-slate-200 animate-pulse shrink-0" />}
                      <div className="h-9 rounded-2xl bg-slate-200 animate-pulse" style={{ width: w }} />
                    </div>
                  ))}
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "bot" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0052cc] text-white mb-0.5">
                        <Bot size={12} />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-[#0052cc] text-white rounded-br-sm"
                        : "bg-white text-slate-700 rounded-bl-sm border border-slate-100"
                    }`}>
                      <p>{msg.text}</p>
                      {msg.tab ? (
                        <button
                          type="button"
                          onClick={() => { setActiveTab(msg.tab!); setChatOpen(false); }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#0052cc]/10 border border-[#0052cc]/20 px-2.5 py-1 text-[11px] font-bold text-[#0052cc] hover:bg-[#0052cc]/20 transition"
                        >
                          Go to {msg.tab} →
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 bg-white px-4 py-3 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChatMessage(); }}
                placeholder="Ask anything..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12.5px] outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-blue-100 transition"
              />
              <button
                type="button"
                onClick={sendChatMessage}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0052cc] text-white transition hover:bg-[#003fa3] active:scale-95"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        ) : null}

        {/* FAB button */}
        <button
          type="button"
          onClick={() => setChatOpen((p) => !p)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#0052cc] to-[#0073e6] text-white shadow-[0_8px_28px_rgba(0,82,204,0.45)] transition hover:shadow-[0_12px_36px_rgba(0,82,204,0.55)] hover:scale-105 active:scale-95"
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
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-400">Loading dashboard...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
