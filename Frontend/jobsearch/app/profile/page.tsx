"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, MapPin, Clock, Edit, Upload, CheckCircle2 } from "lucide-react";
import SignalShell from "../components/SignalShell";
import SectionCard from "../components/SectionCard";
import FormInput from "../components/FormInput";
import PrimaryButton from "../components/PrimaryButton";
import StatCard from "../components/StatCard";
import {
  clearAuth,
  getAccessToken,
  getCurrentUser,
  getProfile,
  saveProfile,
  getResumeData,
  saveResumeData,
} from "../lib/auth";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}`;

const defaultProfile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  bio: "",
  password: "",
};

type ResumeSnapshot = {
  resume_id?: number;
  message?: string;
  resume_details?: Record<string, unknown>;
  recommended_jobs?: Array<Record<string, unknown>>;
  resume_insights?: Record<string, unknown>;
};

type ParsedResumeItem = {
  title: string;
  subtitle?: string;
  details?: string;
  bullets?: string[];
  date?: string;
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

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(defaultProfile);
  const [message, setMessage] = useState<string | null>(null);
  
  // Resume upload states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeData, setResumeData] = useState<ResumeSnapshot | null>(null);
  
  // Dashboard count states
  const [matchedJobsCount, setMatchedJobsCount] = useState(0);
  const [appliedJobsCount, setAppliedJobsCount] = useState(0);
  
  // Edit mode toggle
  const [isEditing, setIsEditing] = useState(false);

  const user = getCurrentUser();
  const hasResume = Boolean(resumeData);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const saved = getProfile();
    if (saved) {
      setProfile({ ...defaultProfile, ...saved, email: saved.email || user?.email || "" });
    } else if (user?.email) {
      setProfile((prev) => ({ ...prev, email: user.email }));
    }

    const cachedResume = getResumeData() as ResumeSnapshot | null;
    if (cachedResume) {
      setResumeData(cachedResume);
      if (Array.isArray(cachedResume.recommended_jobs)) {
        setMatchedJobsCount(cachedResume.recommended_jobs.length);
      }
    }

    setLoading(false);
  }, [router, user?.email]);

  // Fetch counts from APIs
  useEffect(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    if (!token) return;

    // Load applied jobs to get count
    async function fetchApplied() {
      try {
        const res = await fetch(`${API_BASE}/applied/?user_id=${user?.id}`, {
          headers: { Authorization: token || "" },
        });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload.results)) {
            setAppliedJobsCount(payload.results.length);
          }
        }
      } catch (err) {
        console.error("Failed to load applied jobs count", err);
      }
    }

    // Load recommendations to get count if not in cache
    async function fetchMatched() {
      try {
        const res = await fetch(`${API_BASE}/search-jobs/?user_id=${user?.id}`, {
          headers: { Authorization: token || "" },
        });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload.recommended_jobs)) {
            setMatchedJobsCount(payload.recommended_jobs.length);
          }
        }
      } catch (err) {
        console.error("Failed to load matched jobs count", err);
      }
    }

    void fetchApplied();
    if (!matchedJobsCount) {
      void fetchMatched();
    }
  }, [user?.id, matchedJobsCount]);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveProfile(profile);
    setMessage("Profile updated successfully.");
    setIsEditing(false);
    setTimeout(() => setMessage(null), 3000);
  }

  function handleLogout() {
    clearAuth();
    router.replace("/login");
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!selectedFile || !user?.id) {
      setUploadError("Please choose a resume file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", selectedFile);
    formData.append("user_id", String(user.id));

    try {
      setUploading(true);
      const token = getAccessToken();
      const response = await fetch(`${API_BASE}/upload/`, {
        method: "POST",
        headers: {
          Authorization: token || "",
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
        resume_details: payload.resume_details,
        recommended_jobs: payload.recommended_jobs,
        resume_insights: payload.resume_insights,
      };

      setResumeData(nextResume);
      saveResumeData(nextResume);
      if (Array.isArray(payload.recommended_jobs)) {
        setMatchedJobsCount(payload.recommended_jobs.length);
      }
      setUploadSuccess("Application saved and the external parsing has been opened.");
      setSelectedFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const displayName = profile.name || String(resumeData?.resume_details?.name || user?.name || "");
  const displayRole = String(resumeData?.resume_details?.current_designation || "");
  const displayCompany = String(resumeData?.resume_details?.current_company || "");
  const displayEmail = String(resumeData?.resume_details?.email || profile.email || user?.email || "");
  const displayPhone = String(resumeData?.resume_details?.phone || profile.phone || "");
  const displayLocation = String(resumeData?.resume_details?.location || profile.location || "");
  const displayExperience = String(resumeData?.resume_details?.experience_years ?? "");

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
        Loading profile...
      </div>
    );
  }

  return (
    <SignalShell activeTab="profile" onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)} onLogout={handleLogout}>
      <div className="space-y-6">
        {/* Top Row: Stat Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Resume Status" value={hasResume ? "Uploaded" : "Pending"} tone="sky" />
          <StatCard label="Matched Jobs" value={String(matchedJobsCount)} tone="emerald" />
          <StatCard label="Applications" value={String(appliedJobsCount)} tone="violet" />
        </div>

        {/* Middle Row: Resume Manager card */}
        <SectionCard title="Resume Manager" description="Upload a new PDF or DOCX file and let the system analyze it.">
          <div className="mt-4">
            <form onSubmit={handleUpload} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-[66px] flex-1 cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/30 px-4 py-3.5 text-sm text-slate-500 hover:bg-slate-50 transition duration-150">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-purple-600 shadow-sm">
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
            
            {uploadError ? (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3.5 text-xs font-semibold text-rose-600">{uploadError}</p>
            ) : null}
            
            {uploadSuccess ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                <span>{uploadSuccess}</span>
              </div>
            ) : null}
          </div>
        </SectionCard>

        {/* Bottom Columns: User Info, Skills, Education */}
        <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
          
          {/* Left Panel: Profile Detail Card / Form */}
          <div className="rounded-[20px] border border-slate-100 bg-white p-6 shadow-sm shadow-purple-950/[0.015]">
            {isEditing ? (
              /* Editable profile form */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-black text-slate-800">Edit Personal Info</h3>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                
                <form onSubmit={handleSave} className="space-y-4">
                  <FormInput
                    label="Full Name"
                    name="name"
                    value={profile.name}
                    onChange={(value) => setProfile((prev) => ({ ...prev, name: value }))}
                    placeholder="Your full name"
                    required
                  />
                  <FormInput
                    label="Email Address"
                    name="email"
                    value={profile.email}
                    onChange={(value) => setProfile((prev) => ({ ...prev, email: value }))}
                    type="email"
                    placeholder="you@example.com"
                    required
                  />
                  <FormInput
                    label="Phone Number"
                    name="phone"
                    value={profile.phone}
                    onChange={(value) => setProfile((prev) => ({ ...prev, phone: value }))}
                    placeholder="Phone number"
                  />
                  <FormInput
                    label="Location"
                    name="location"
                    value={profile.location}
                    onChange={(value) => setProfile((prev) => ({ ...prev, location: value }))}
                    placeholder="City, country"
                  />
                  <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span className="text-[13px] font-semibold text-slate-700">Bio</span>
                    <textarea
                      value={profile.bio}
                      onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#8b5cf6] focus:bg-white focus:ring-4 focus:ring-purple-100/50"
                      placeholder="Write a brief professional summary"
                    />
                  </div>
                  <FormInput
                    label="Change Password"
                    name="password"
                    value={profile.password ?? ""}
                    onChange={(value) => setProfile((prev) => ({ ...prev, password: value }))}
                    type="password"
                    placeholder="New password"
                  />
                  
                  <PrimaryButton type="submit" className="w-full py-3">
                    Save Changes
                  </PrimaryButton>
                </form>
              </div>
            ) : (
              /* Read-only profile details view (Matches profile.png left panel) */
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-full flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-[#8b5cf6] hover:text-[#7c3aed] hover:underline"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit Profile</span>
                  </button>
                </div>

                <div className="flex flex-col items-center">
                  {/* Purple avatar badge */}
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#a855f7] text-[20px] font-bold text-white shadow-md shadow-purple-500/10">
                    {initials}
                  </div>
                  
                  <h3 className="mt-4 text-[19px] font-extrabold text-slate-800 tracking-tight">{displayName}</h3>
                  <p className="mt-0.5 text-[13.5px] font-bold text-[#8b5cf6]">{displayRole || "Profession"}</p>
                  {displayCompany ? (
                    <p className="text-[12.5px] font-medium text-slate-400 mt-0.5">{displayCompany}</p>
                  ) : null}
                </div>

                <hr className="w-full border-slate-100" />

                {/* Contact list with icons */}
                <div className="w-full space-y-3.5 text-left text-[13.5px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium break-all">{displayEmail}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium">{displayPhone || "Not specified"}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium">{displayLocation || "Not specified"}</span>
                  </div>
                </div>

                <hr className="w-full border-slate-100" />

                {/* Experience & Skills counts */}
                <div className="w-full grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Experience</p>
                    <p className="text-[16px] font-black text-slate-800 leading-none">{displayExperience ? `${displayExperience} yr` : "0 yr"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Skills Identified</p>
                    <p className="text-[16px] font-black text-[#8b5cf6] leading-none">{skills.length}</p>
                  </div>
                </div>
              </div>
            )}

            {message ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 text-center">{message}</p>
            ) : null}
          </div>

          {/* Right Panel: Technical Skills & Education */}
          <div className="space-y-6">
            
            {/* Technical Skills Card */}
            <div className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-sm shadow-purple-950/[0.015] md:p-6">
              <h3 className="text-[17px] font-black tracking-tight text-slate-800 mb-4">Technical Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skills.length ? (
                  skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-slate-50 border border-slate-100 px-4.5 py-1.5 text-[12.5px] font-bold text-slate-600 transition hover:bg-slate-100"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-slate-400 font-medium">Upload your resume to extract skills automatically.</span>
                )}
              </div>
            </div>

            {/* Education Card */}
            <div className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-sm shadow-purple-950/[0.015] md:p-6">
              <h3 className="text-[17px] font-black tracking-tight text-slate-800 mb-4">Education</h3>
              {educationItems.length ? (
                <div className="space-y-4">
                  {educationItems.map((item, index) => (
                    <div key={`${item.title || index}`} className="space-y-1">
                      <h4 className="text-[15px] font-extrabold text-slate-800 tracking-tight">{item.title || "Education"}</h4>
                      {item.subtitle ? <p className="text-[13px] font-medium text-slate-400">{item.subtitle}</p> : null}
                      {item.details ? <p className="text-[12.5px] font-medium text-slate-400">{item.details}</p> : null}
                      {item.date ? (
                        <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#8b5cf6] pt-1">
                          <Clock size={16} />
                          <span>{item.date}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-slate-400 font-medium">No education details parsed yet.</div>
              )}
            </div>

          </div>
        </div>

        {/* Footer/Projects Row */}
        <div className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-sm shadow-purple-950/[0.015] md:p-6">
          <h3 className="text-[17px] font-black tracking-tight text-slate-800 mb-4">Projects</h3>
          {projectItems.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              {projectItems.map((item, index) => (
                <article
                  key={`${item.title || index}`}
                  className="rounded-xl border border-slate-100 bg-slate-50/20 p-5 transition hover:shadow-md hover:shadow-purple-950/[0.01] duration-150"
                >
                  <h4 className="text-[15px] font-extrabold text-slate-800 tracking-tight">{item.title || "Project"}</h4>
                  {item.subtitle ? (
                    <p className="mt-1 font-mono text-[11px] font-bold text-[#8b5cf6] tracking-wider uppercase">{item.subtitle}</p>
                  ) : null}
                  {item.details ? (
                    <p className="mt-2.5 text-[13px] leading-relaxed text-slate-500 font-medium">{item.details}</p>
                  ) : null}
                  {item.bullets?.length ? (
                    <ul className="mt-3.5 space-y-2 text-[12.5px] text-slate-500 font-medium">
                      {item.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-slate-400 font-medium">No project details parsed yet.</div>
          )}
        </div>
      </div>
    </SignalShell>
  );
}
