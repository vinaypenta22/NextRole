from django.contrib import admin
from .models import userModel , Resume , Job , AppliedJob
# Register your models here.
admin.site.register(userModel)
admin.site.register(Resume)
admin.site.register(Job)
admin.site.register(AppliedJob)