from typing import Any, Dict, Optional

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Resume, userModel
from .resume_ai_service import ResumeAIService


class ResumeAIBaseAPIView(APIView):
    service_class = ResumeAIService

    def get_service(self) -> ResumeAIService:
        return self.service_class()

    def get_resume_details(self, request) -> Optional[Dict[str, Any]]:
        resume_details = request.data.get("resume_details") or {}
        if isinstance(resume_details, dict) and resume_details:
            return resume_details

        user_id = request.data.get("user_id") or request.query_params.get("user_id")
        if not user_id:
            return None

        try:
            user = userModel.objects.get(id=user_id)
        except userModel.DoesNotExist:
            return None

        persisted_resume = Resume.objects.filter(user=user).order_by("-updated_at", "-created_at").first()
        if persisted_resume and isinstance(persisted_resume.resume_details, dict):
            return persisted_resume.resume_details
        return None


class ResumeATSAPIView(ResumeAIBaseAPIView):
    def post(self, request):
        resume_details = self.get_resume_details(request)
        if not resume_details:
            return Response({"message": "resume_details or user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        service = self.get_service()
        result = service.generate_ats_score(resume_details)
        if not isinstance(result, dict):
            return Response({"message": "Unable to generate ATS insights."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(result, status=status.HTTP_200_OK)


class ResumeInterviewAPIView(ResumeAIBaseAPIView):
    def get(self, request):
        resume_details = self.get_resume_details(request)
        if not resume_details:
            return Response({"message": "resume_details or user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        skill = str(request.query_params.get("skill") or "").strip()
        service = self.get_service()
        result = service.get_cached_interview_questions(resume_details, skill=skill or None)
        return Response(result, status=status.HTTP_200_OK)

    def post(self, request):
        skill = str(request.data.get("skill") or request.query_params.get("skill") or "").strip()
        if not skill:
            return Response({"message": "skill is required."}, status=status.HTTP_400_BAD_REQUEST)

        mode = str(request.data.get("mode") or request.query_params.get("mode") or "initial").strip().lower()
        if mode not in {"initial", "reload", "more"}:
            mode = "initial"

        resume_details = self.get_resume_details(request)
        if not resume_details:
            return Response({"message": "resume_details or user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        service = self.get_service()
        result = service.generate_interview_questions(skill, resume_details, mode=mode)
        if not isinstance(result, dict):
            return Response({"message": "Unable to generate interview questions."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(result, status=status.HTTP_200_OK)
