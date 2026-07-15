from django.db import models
from rest_framework.decorators import APIView
# Create your models here.
class userModel(models.Model):
    name = models.CharField(max_length=30,blank=True , null= True)
    email = models.EmailField(max_length=30,blank=True , null= True , unique=True)
    password = models.CharField(max_length=30,blank=True , null= True)
    confirm_password = models.CharField(max_length=30,blank=True , null= True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name

#resume Upload
class Resume(models.Model):
    user = models.ForeignKey(userModel, on_delete=models.CASCADE)
    resume = models.FileField(upload_to="resumes/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_resume_uploaded = models.BooleanField(default=False)
    extracted_text = models.TextField(blank=True)
    resume_details = models.JSONField(default=dict, blank=True)
    skills = models.JSONField(default=list)
    experience = models.CharField(max_length=100, blank=True)
    education = models.JSONField(default=list)
    projects = models.JSONField(default=list)
    certifications = models.JSONField(default=list)
    last_search_filters = models.JSONField(default=dict, blank=True)
    last_recommended_jobs = models.JSONField(default=list, blank=True)
    search_query = models.CharField(max_length=255, blank=True, default="")
    provider_responses = models.JSONField(default=dict, blank=True)
    resume_insights = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Job(models.Model):
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    experience = models.CharField(max_length=100)
    salary = models.CharField(max_length=100, blank=True, null=True)
    skills = models.JSONField(default=list)

    def __str__(self):
        return self.title


class AppliedJob(models.Model):
    user = models.ForeignKey(userModel, on_delete=models.CASCADE, related_name="applied_jobs")
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255, blank=True, default="")
    location = models.CharField(max_length=255, blank=True, default="")
    employment_type = models.CharField(max_length=100, blank=True, default="")
    work_mode = models.CharField(max_length=100, blank=True, default="")
    experience = models.CharField(max_length=100, blank=True, default="")
    posted_at = models.CharField(max_length=100, blank=True, default="")
    summary = models.TextField(blank=True, default="")
    description = models.TextField(blank=True, default="")
    apply_link = models.URLField(blank=True, default="")
    match_score = models.FloatField(default=0)
    raw_data = models.JSONField(default=dict, blank=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.user_id}"
