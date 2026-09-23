"""Use Google Sheets participant keys and add college placement."""
from alembic import op
import sqlalchemy as sa

revision = "20260923_0006"
down_revision = "20260922_0005"
branch_labels = None
depends_on = None


def upgrade():
    for name, default in (("college_x", "50"), ("college_y", "62")):
        op.add_column("certificate_templates", sa.Column(name, sa.Float(), nullable=False, server_default=default))
    op.add_column("certificate_templates", sa.Column("college_font_size", sa.Integer(), nullable=False, server_default="22"))
    op.add_column("certificate_templates", sa.Column("college_alignment", sa.String(10), nullable=False, server_default="center"))
    op.add_column("certificate_templates", sa.Column("college_color", sa.String(7), nullable=False, server_default="#171717"))
    op.add_column("email_deliveries", sa.Column("participant_key", sa.String(320)))
    op.add_column("email_deliveries", sa.Column("participant_name", sa.String(160)))
    op.add_column("email_deliveries", sa.Column("college", sa.String(160)))
    op.execute("UPDATE email_deliveries SET participant_key = 'legacy:' || participant_id::text")
    op.execute("UPDATE email_deliveries d SET participant_name = p.full_name, college = p.college FROM participants p WHERE p.id = d.participant_id")
    op.alter_column("email_deliveries", "participant_key", nullable=False)
    op.alter_column("email_deliveries", "participant_name", nullable=False)
    op.drop_constraint("email_deliveries_campaign_id_participant_id_key", "email_deliveries", type_="unique")
    op.drop_constraint("email_deliveries_participant_id_fkey", "email_deliveries", type_="foreignkey")
    op.create_unique_constraint("uq_email_delivery_campaign_participant_key", "email_deliveries", ["campaign_id", "participant_key"])


def downgrade():
    op.drop_constraint("uq_email_delivery_campaign_participant_key", "email_deliveries", type_="unique")
    op.create_foreign_key("email_deliveries_participant_id_fkey", "email_deliveries", "participants", ["participant_id"], ["id"])
    op.create_unique_constraint("email_deliveries_campaign_id_participant_id_key", "email_deliveries", ["campaign_id", "participant_id"])
    for name in ("college", "participant_name", "participant_key"):
        op.drop_column("email_deliveries", name)
    for name in ("college_color", "college_alignment", "college_font_size", "college_y", "college_x"):
        op.drop_column("certificate_templates", name)
