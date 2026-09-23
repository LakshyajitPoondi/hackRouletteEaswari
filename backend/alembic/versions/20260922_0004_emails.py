"""Email templates, campaigns and deliveries."""
from alembic import op
import sqlalchemy as sa

revision = "20260922_0004"
down_revision = "20260922_0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("email_templates",
        sa.Column("id", sa.Integer, primary_key=True), sa.Column("name", sa.String(160), nullable=False),
        sa.Column("subject", sa.String(300), nullable=False), sa.Column("body", sa.Text, nullable=False),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("email_campaigns",
        sa.Column("id", sa.Integer, primary_key=True), sa.Column("name", sa.String(160), nullable=False),
        sa.Column("email_template_id", sa.Integer, sa.ForeignKey("email_templates.id", ondelete="SET NULL")),
        sa.Column("certificate_template_id", sa.Integer, sa.ForeignKey("certificate_templates.id", ondelete="SET NULL")),
        sa.Column("sender_name", sa.String(160), nullable=False), sa.Column("reply_to", sa.String(320)),
        sa.Column("subject", sa.String(300), nullable=False), sa.Column("body", sa.Text, nullable=False),
        sa.Column("attach_certificate", sa.Boolean, nullable=False), sa.Column("status", sa.String(24), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True)), sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.create_table("email_deliveries",
        sa.Column("id", sa.Integer, primary_key=True), sa.Column("campaign_id", sa.Integer, sa.ForeignKey("email_campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_id", sa.Integer, sa.ForeignKey("participants.id"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False), sa.Column("status", sa.String(16), nullable=False),
        sa.Column("provider_message_id", sa.String(255)), sa.Column("attempt_count", sa.Integer, nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True)), sa.Column("failed_at", sa.DateTime(timezone=True)),
        sa.Column("failure_reason", sa.Text), sa.UniqueConstraint("campaign_id", "participant_id"))
    op.create_index("ix_email_deliveries_campaign_id", "email_deliveries", ["campaign_id"])


def downgrade():
    op.drop_index("ix_email_deliveries_campaign_id", table_name="email_deliveries")
    op.drop_table("email_deliveries")
    op.drop_table("email_campaigns")
    op.drop_table("email_templates")
