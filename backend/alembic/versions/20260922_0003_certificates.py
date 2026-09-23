"""Add certificate templates and generated certificates.

Revision ID: 20260922_0003
Revises: 20260922_0002
"""

from alembic import op
import sqlalchemy as sa

revision = "20260922_0003"
down_revision = "20260922_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "certificate_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("name_x", sa.Float(), nullable=False),
        sa.Column("name_y", sa.Float(), nullable=False),
        sa.Column("name_font_size", sa.Integer(), nullable=False),
        sa.Column("name_alignment", sa.String(10), nullable=False),
        sa.Column("name_color", sa.String(7), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("uq_certificate_template_active", "certificate_templates", ["is_active"], unique=True, postgresql_where=sa.text("is_active = true"))
    op.create_table(
        "certificates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("participant_id", sa.Integer(), sa.ForeignKey("participants.id"), nullable=False, unique=True),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("certificate_templates.id"), nullable=False),
        sa.Column("certificate_id", sa.String(32), nullable=True, unique=True),
        sa.Column("file_path", sa.String(500)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("certificates")
    op.drop_index("uq_certificate_template_active", table_name="certificate_templates")
    op.drop_table("certificate_templates")
