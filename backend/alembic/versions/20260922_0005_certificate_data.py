"""Keep certificate assets in PostgreSQL for serverless functions."""
from alembic import op
import sqlalchemy as sa

revision = "20260922_0005"
down_revision = "20260922_0004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("certificate_templates", sa.Column("file_data", sa.LargeBinary(), nullable=True))
    op.add_column("certificates", sa.Column("file_data", sa.LargeBinary(), nullable=True))


def downgrade():
    op.drop_column("certificates", "file_data")
    op.drop_column("certificate_templates", "file_data")
