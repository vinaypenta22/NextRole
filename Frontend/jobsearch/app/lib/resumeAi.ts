import { getAccessToken, getCurrentUser } from "./auth";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}`;

export type ResumeDetails = Record<string, unknown>;

async function postResumeAi<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${getAccessToken()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Unable to load AI content.");
  }

  return data as T;
}

function buildPayload(resumeDetails?: ResumeDetails | null, userId?: number | null) {
  return {
    user_id: userId ?? getCurrentUser()?.id,
    resume_details: resumeDetails || {},
  };
}

export type AtsPayload = {
  ats_resume_score: number;
  resume_improvement_suggestions: string[];
};

export async function fetchAtsInsights(resumeDetails?: ResumeDetails | null, userId?: number | null) {
  return postResumeAi<AtsPayload>("resume/ats/", buildPayload(resumeDetails, userId));
}

export type InterviewItem = {
  skill?: string;
  level?: string;
  question?: string;
  answer?: string;
};

export async function fetchCachedInterviewQuestions(resumeDetails?: ResumeDetails | null, userId?: number | null, skill?: string) {
  const query = new URLSearchParams();
  const effectiveUserId = userId ?? getCurrentUser()?.id;
  if (effectiveUserId) query.set("user_id", String(effectiveUserId));
  if (skill) query.set("skill", skill);

  const response = await fetch(`${API_BASE}/resume/interview/?${query.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${getAccessToken()}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Unable to load cached interview questions.");
  }

  return data as {
    interview_questions_by_skill: Record<string, InterviewItem[]>;
    skills: string[];
  };
}

export async function fetchInterviewQuestions(skill: string, resumeDetails?: ResumeDetails | null, userId?: number | null, mode: "initial" | "reload" | "more" = "initial") {
  return postResumeAi<{ interview_questions: InterviewItem[] }>("resume/interview/", {
    ...buildPayload(resumeDetails, userId),
    skill,
    mode,
  });
}
