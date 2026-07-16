from django.urls import path
from .views import userAuthAPIView, UserLoginAPIView, ResumeUploadAPIView, AppliedJobAPIView, JobSearchAPIView, SavedJobAPIView, ChatAPIView

urlpatterns = [
    path('register/', userAuthAPIView.as_view()),
    path('login/', UserLoginAPIView.as_view()),
    path('upload/', ResumeUploadAPIView.as_view()),
    path('search-jobs/', JobSearchAPIView.as_view()),
    path('applied/', AppliedJobAPIView.as_view()),
    path('saved-jobs/', SavedJobAPIView.as_view()),
    path('chat/', ChatAPIView.as_view()),
]
