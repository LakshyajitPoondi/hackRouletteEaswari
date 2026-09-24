"""Remove the unused scheduling column from manual campaigns."""
from alembic import op
import sqlalchemy as sa

revision = "20260924_0008"
down_revision = "20260923_0007"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("email_campaigns", "scheduled_for")


def downgrade():
    op.add_column("email_campaigns", sa.Column("scheduled_for", sa.DateTime(timezone=True)))
