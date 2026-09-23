"""Remove obsolete participant and personalized-certificate storage.

Google Sheets is the participant source of truth. Migration 0006 copied the
delivery fields still needed for campaign history before these tables are dropped.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260923_0007"
down_revision = "20260923_0006"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("certificates")
    op.drop_table("participants")
    op.drop_table("teams")
    op.drop_column("certificate_templates", "file_path")
    postgresql.ENUM(name="attendance_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="registration_source").drop(op.get_bind(), checkfirst=True)


def downgrade():
    op.add_column("certificate_templates", sa.Column("file_path", sa.String(500), nullable=False, server_default=""))
    op.alter_column("certificate_templates", "file_path", server_default=None)
    source = postgresql.ENUM("GOOGLE_FORM", name="registration_source", create_type=False)
    attendance = postgresql.ENUM("REGISTERED", "PRESENT", "ABSENT", name="attendance_status", create_type=False)
    source.create(op.get_bind(), checkfirst=True)
    attendance.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("team_name", sa.String(160), nullable=False),
        sa.Column("normalized_name", sa.String(160), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
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
    op.execute(
        """
        INSERT INTO participants (
            id, full_name, email, registration_source, registration_timestamp,
            attendance_status, certificate_eligible, is_disqualified, created_at, updated_at
        )
        SELECT participant_id, MAX(participant_name), MAX(email),
               'GOOGLE_FORM'::registration_source, NOW(),
               'REGISTERED'::attendance_status, FALSE, FALSE, NOW(), NOW()
        FROM email_deliveries
        GROUP BY participant_id
        """
    )
    op.execute(
        "SELECT setval(pg_get_serial_sequence('participants', 'id'), "
        "COALESCE((SELECT MAX(id) FROM participants), 1), "
        "EXISTS (SELECT 1 FROM participants))"
    )
    op.create_table(
        "certificates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("participant_id", sa.Integer(), sa.ForeignKey("participants.id"), nullable=False, unique=True),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("certificate_templates.id"), nullable=False),
        sa.Column("certificate_id", sa.String(32), unique=True),
        sa.Column("file_path", sa.String(500)),
        sa.Column("file_data", sa.LargeBinary()),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
