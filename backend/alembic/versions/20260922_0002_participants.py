"""Add teams and participants.

Revision ID: 20260922_0002
Revises: 20260922_0001
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260922_0002"
down_revision = "20260922_0001"
branch_labels = None
depends_on = None


def upgrade():
    source = postgresql.ENUM("GOOGLE_FORM", name="registration_source", create_type=False)
    attendance = postgresql.ENUM("REGISTERED", "PRESENT", "ABSENT", name="attendance_status", create_type=False)
    source.create(op.get_bind(), checkfirst=True)
    attendance.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_name", sa.String(160), nullable=False),
        sa.Column("normalized_name", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("normalized_name", name="uq_teams_normalized_name"),
    )
    op.create_table(
        "participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(32)),
        sa.Column("college", sa.String(160)),
        sa.Column("department", sa.String(160)),
        sa.Column("year", sa.String(32)),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id", ondelete="SET NULL")),
        sa.Column("registration_source", source, nullable=False),
        sa.Column("registration_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attendance_status", attendance, nullable=False),
        sa.Column("certificate_eligible", sa.Boolean(), nullable=False),
        sa.Column("is_disqualified", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_participants_email", "participants", ["email"], unique=True)
    op.create_index("ix_participants_team_id", "participants", ["team_id"])
    op.create_index("ix_participants_attendance_status", "participants", ["attendance_status"])
    op.create_index("ix_participants_registration_timestamp", "participants", ["registration_timestamp"])


def downgrade():
    op.drop_index("ix_participants_registration_timestamp", table_name="participants")
    op.drop_index("ix_participants_attendance_status", table_name="participants")
    op.drop_index("ix_participants_team_id", table_name="participants")
    op.drop_index("ix_participants_email", table_name="participants")
    op.drop_table("participants")
    op.drop_table("teams")
    postgresql.ENUM(name="attendance_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="registration_source").drop(op.get_bind(), checkfirst=True)
