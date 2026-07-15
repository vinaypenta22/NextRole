from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("userside", "0003_usermodel_groups_usermodel_is_active_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="AppliedJob",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("company", models.CharField(blank=True, default="", max_length=255)),
                ("location", models.CharField(blank=True, default="", max_length=255)),
                ("employment_type", models.CharField(blank=True, default="", max_length=100)),
                ("work_mode", models.CharField(blank=True, default="", max_length=100)),
                ("experience", models.CharField(blank=True, default="", max_length=100)),
                ("posted_at", models.CharField(blank=True, default="", max_length=100)),
                ("summary", models.TextField(blank=True, default="")),
                ("description", models.TextField(blank=True, default="")),
                ("apply_link", models.URLField(blank=True, default="")),
                ("match_score", models.FloatField(default=0)),
                ("raw_data", models.JSONField(blank=True, default=dict)),
                ("applied_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="applied_jobs",
                        to="userside.usermodel",
                    ),
                ),
            ],
        ),
    ]
