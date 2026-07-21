import hashlib
import json
import os
import time
from typing import Any, Dict, List, Optional

try:
    from groq import Groq
except Exception:
    Groq = None

from .models import ResumeInsight


class ResumeAIService:
    model_name = "llama-3.1-8b-instant"
    max_tokens = 2000
    temperature = 0.2

    def __init__(self, client: Optional[Groq] = None):
        self.client = client or (Groq(api_key=os.getenv("GROQ_API_KEY")) if Groq else None)

    def _resume_hash(self, resume_details: Dict[str, Any]) -> str:
        payload = json.dumps(resume_details or {}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _compact_context(self, resume_details: Dict[str, Any]) -> Dict[str, Any]:
        skills = resume_details.get("skills") or []
        if not isinstance(skills, list):
            skills = [skills]

        return {
            "name": resume_details.get("name") or "",
            "designation": resume_details.get("current_designation") or resume_details.get("designation") or "",
            "company": resume_details.get("current_company") or "",
            "experience_years": resume_details.get("experience_years") or 0,
            "location": resume_details.get("location") or "",
            "skills": [str(skill).strip() for skill in skills if str(skill).strip()][:10],
            "summary": resume_details.get("summary") or resume_details.get("bio") or resume_details.get("experience") or "",
        }

    def _skill_list(self, resume_details: Dict[str, Any], limit: int = 5) -> List[str]:
        skills = resume_details.get("skills") or []
        if not isinstance(skills, list):
            skills = [skills]
        cleaned = [str(skill).strip() for skill in skills if str(skill).strip()]
        return cleaned[:limit]

    def _role(self, resume_details: Dict[str, Any]) -> str:
        return (
            str(resume_details.get("current_designation") or resume_details.get("designation") or "Software Developer")
            .strip()
            or "Software Developer"
        )

    def _local_ats_score(self, resume_details: Dict[str, Any]) -> Dict[str, Any]:
        skills = self._skill_list(resume_details, 10)
        score = 58 + min(len(skills) * 4, 24)
        if resume_details.get("summary") or resume_details.get("bio"):
            score += 4
        if resume_details.get("experience_years"):
            score += 4
        score = max(0, min(100, score))
        suggestions = [
            "Add measurable impact to your most recent bullets.",
            f"Tailor the summary to {self._role(resume_details)} roles.",
            "List projects with outcomes, tools, and results.",
            "Use job keywords that match your core skills.",
        ]
        return {
            "ats_resume_score": score,
            "resume_improvement_suggestions": suggestions,
        }

    def _local_interview_questions(self, skill: str, resume_details: Dict[str, Any], batch_label: str = "batch_1") -> Dict[str, Any]:
        role = self._role(resume_details)
        skill_name = skill.strip()
        templates = [
            ("Basic", f"What is {skill_name}?", f"{skill_name} is a core technology used in modern {role.lower()} work. Focus on its purpose, key concepts, and where it fits in production systems."),
            ("Basic", f"What problem does {skill_name} solve?", f"Explain the business or technical problem {skill_name} addresses, and why it is used in real projects."),
            ("Intermediate", f"How do you use {skill_name} effectively in a real project?", f"Explain how {skill_name} solves a real problem, mention setup, common patterns, and one practical example from a project or workflow."),
            ("Intermediate", f"What are common mistakes when using {skill_name}?", f"Talk about implementation mistakes, edge cases, and how to avoid them in production."),
            ("Advanced", f"What are the main tradeoffs when scaling {skill_name} solutions?", f"Discuss performance, maintainability, error handling, security, and operational tradeoffs when {skill_name} is used at scale."),
            ("Advanced", f"How would you design a production-ready {skill_name} solution?", f"Cover architecture, testing, observability, failure handling, and deployment considerations."),
            ("Coding", f"Write a small solution using {skill_name}.", f"# Example implementation for {skill_name}\n# Adapt the approach to your stack.\n\nprint('Implement a practical {skill_name} example here')"),
            ("Coding", f"Fix a bug or improve a {skill_name} implementation.", f"# Review the logic, handle edge cases, and explain the fix.\n\nprint('Show an improved {skill_name} solution here')"),
        ]
        return {
            "batch_id": batch_label,
            "interview_questions": [
                {"skill": skill_name, "batch_id": batch_label, "level": level, "question": question, "answer": answer}
                for level, question, answer in templates
            ]
        }

    def _load_cache(self, resume_hash: str) -> Optional[ResumeInsight]:
        return ResumeInsight.objects.filter(resume_hash=resume_hash).first()

    def _skill_questions_from_cache(self, cached: Optional[ResumeInsight], skill: str) -> List[Dict[str, Any]]:
        if not cached or not isinstance(cached.interview_questions, list):
            return []

        normalized_skill = skill.strip().lower()
        items = []
        for item in cached.interview_questions:
            if not isinstance(item, dict):
                continue
            if str(item.get("skill", "")).strip().lower() != normalized_skill:
                continue
            if all(key in item for key in ("skill", "batch_id", "level", "question", "answer")):
                items.append(item)
        return items

    def get_cached_interview_questions(self, resume_details: Dict[str, Any], skill: Optional[str] = None) -> Dict[str, Any]:
        if not isinstance(resume_details, dict):
            return {"interview_questions_by_skill": {}, "skills": []}

        resume_hash = self._resume_hash(resume_details)
        cached = self._load_cache(resume_hash)
        if not cached or not isinstance(cached.interview_questions, list):
            return {"interview_questions_by_skill": {}, "skills": []}

        selected_skill = str(skill or "").strip().lower()
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for item in cached.interview_questions:
            if not isinstance(item, dict):
                continue
            item_skill = str(item.get("skill", "")).strip()
            if not item_skill:
                continue
            if selected_skill and item_skill.lower() != selected_skill:
                continue
            grouped.setdefault(item_skill, []).append(item)

        return {
            "interview_questions_by_skill": grouped,
            "skills": list(grouped.keys()),
        }

    def _save_skill_questions(
        self,
        resume_hash: str,
        skill: str,
        questions: List[Dict[str, Any]],
        mode: str,
    ) -> List[Dict[str, Any]]:
        cache, _ = ResumeInsight.objects.get_or_create(resume_hash=resume_hash)
        existing = [item for item in (cache.interview_questions or []) if isinstance(item, dict)]
        normalized_skill = skill.strip().lower()

        if mode == "reload":
            existing = [
                item for item in existing
                if str(item.get("skill", "")).strip().lower() != normalized_skill
            ]

        if mode in {"reload", "more"}:
            existing.extend(questions)
        else:
            existing = [
                item for item in existing
                if str(item.get("skill", "")).strip().lower() != normalized_skill
            ] + questions

        cache.interview_questions = existing
        cache.save(update_fields=["interview_questions"])
        return questions

    def _save_cache(self, resume_hash: str, **fields: Any) -> ResumeInsight:
        cache, _ = ResumeInsight.objects.get_or_create(resume_hash=resume_hash)
        for key, value in fields.items():
            if value not in (None, "", [], {}):
                setattr(cache, key, value)
        cache.save()
        return cache

    def _build_prompt(self, title: str, context: Dict[str, Any], instructions: str, output_example: str) -> str:
        context_json = json.dumps(context, ensure_ascii=False)
        return (
            f"{title}\n"
            f"Resume: {context_json}\n"
            f"{instructions}\n"
            f"Return only JSON in this shape: {output_example}"
        )

    def _call_json(self, system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None

        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=self.temperature,
                    max_tokens=max_tokens or self.max_tokens,
                    response_format={"type": "json_object"},
                )
                content = response.choices[0].message.content.strip()
                parsed = json.loads(content)
                if not isinstance(parsed, dict):
                    raise ValueError("AI response was not a JSON object.")
                return parsed
            except Exception as exc:
                if attempt == 2:
                    print("ResumeAIService failed:", str(exc))
                    return None
                time.sleep(1.25 * (attempt + 1))
        return None

    def generate_ats_score(self, resume_details: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not isinstance(resume_details, dict):
            return None

        resume_hash = self._resume_hash(resume_details)
        cached = self._load_cache(resume_hash)
        if cached and (cached.ats_score or cached.suggestions):
            return {
                "ats_resume_score": int(cached.ats_score or 0),
                "resume_improvement_suggestions": list(cached.suggestions or []),
            }

        context = self._compact_context(resume_details)
        prompt = self._build_prompt(
            "Generate ATS feedback.",
            context,
            "Return a score from 0 to 100 plus 3 to 5 short, actionable resume suggestions. Score based on keywords, clarity, impact, and ATS fit. No markdown. No extra fields.",
            '{"ats_resume_score": 82, "resume_improvement_suggestions": ["..."]}',
        )
        parsed = self._call_json(
            "You are an ATS resume scorer. Return concise JSON only.",
            prompt,
        )
        if not parsed:
            return self._local_ats_score(resume_details)

        try:
            score = int(float(parsed.get("ats_resume_score", 0)))
        except (TypeError, ValueError):
            score = 0

        suggestions = parsed.get("resume_improvement_suggestions")
        if not isinstance(suggestions, list):
            return None

        cleaned_suggestions = [str(item).strip() for item in suggestions if str(item).strip()][:5]
        result = {
            "ats_resume_score": max(0, min(100, score)),
            "resume_improvement_suggestions": cleaned_suggestions,
        }
        self._save_cache(
            resume_hash,
            ats_score=result["ats_resume_score"],
            suggestions=cleaned_suggestions,
        )
        return result

    def generate_interview_questions(self, skill: str, resume_details: Dict[str, Any], mode: str = "initial") -> Optional[Dict[str, Any]]:
        skill = str(skill or "").strip()
        if not skill or not isinstance(resume_details, dict):
            return None

        resume_hash = self._resume_hash(resume_details)
        cached = self._load_cache(resume_hash)
        cached_items = self._skill_questions_from_cache(cached, skill)
        if cached_items and mode == "initial":
            return {"interview_questions": cached_items, "batch_id": cached_items[0].get("batch_id", "cached"), "cached": True}

        context = self._compact_context(resume_details)
        batch_id = f"{mode}_{int(time.time())}"
        prompt = self._build_prompt(
            f"Generate interview questions for {skill}.",
            context,
            f"Write exactly 8 items for the skill '{skill}': 2 Basic, 2 Intermediate, 2 Advanced, 2 Coding. Use the most common interview questions. Each item must have skill, batch_id, level, question, answer. Coding answer must include complete working code and a short explanation. Keep answers concise and interview-ready.",
            '{"interview_questions":[{"skill":"","batch_id":"","level":"","question":"","answer":""}]}',
        )
        parsed = self._call_json(
            "You are a technical interview coach. Return concise JSON only.",
            prompt,
        )
        if not parsed:
            local = self._local_interview_questions(skill, resume_details, batch_label=batch_id)
            self._save_skill_questions(resume_hash, skill, local["interview_questions"], mode)
            return local

        items = parsed.get("interview_questions")
        if not isinstance(items, list):
            local = self._local_interview_questions(skill, resume_details, batch_label=batch_id)
            self._save_skill_questions(resume_hash, skill, local["interview_questions"], mode)
            return local

        cleaned: List[Dict[str, Any]] = []
        required_levels = {"basic", "intermediate", "advanced", "coding"}
        seen_levels = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            level = str(item.get("level") or "").strip()
            question = str(item.get("question") or "").strip()
            answer = str(item.get("answer") or "").strip()
            if not question or not answer:
                continue
            cleaned_item = {
                "skill": skill,
                "batch_id": str(item.get("batch_id") or batch_id).strip() or batch_id,
                "level": level,
                "question": question,
                "answer": answer,
            }
            cleaned.append(cleaned_item)
            seen_levels.add(level.lower())

        if len(cleaned) < 8 or not required_levels.issubset(seen_levels):
            local = self._local_interview_questions(skill, resume_details, batch_label=batch_id)
            self._save_skill_questions(resume_hash, skill, local["interview_questions"], mode)
            return local

        stored = self._save_skill_questions(resume_hash, skill, cleaned, mode)
        return {"interview_questions": stored, "batch_id": batch_id, "cached": False}
