import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-only-jwt-secret-with-more-than-32-characters"
os.environ["FRONTEND_ORIGIN"] = "http://127.0.0.1:5173"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Role, User
from app.services.google_sheets import SheetParticipant


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(db):
    def override():
        yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db):
    def create(role: Role, email: str):
        user = User(name=role.value, email=email, password_hash=hash_password("strong-test-password-123"), role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    return create


@pytest.fixture
def login(client):
    def sign_in(email: str):
        response = client.post("/api/auth/login", json={"email": email, "password": "strong-test-password-123"})
        assert response.status_code == 200
    return sign_in


@pytest.fixture(autouse=True)
def fake_sheet(monkeypatch):
    class FakeSource:
        def __init__(self): self.people = []
        def list(self): return list(self.people)
        def get(self, row_number):
            from fastapi import HTTPException
            person = next((p for p in self.people if p.id == row_number), None)
            if not person: raise HTTPException(404, "Participant not found")
            return person
        def update(self, row_number, changes):
            person = self.get(row_number)
            for key, value in changes.items():
                if hasattr(value, "value"): value = value.value
                setattr(person, key, value)
            return person
    source = FakeSource()
    monkeypatch.setattr("app.services.participants.participant_source", lambda: source)
    monkeypatch.setattr("app.api.certificates.participant_source", lambda: source)
    monkeypatch.setattr("app.services.email_campaigns.participant_source", lambda: source)
    monkeypatch.setattr("app.api.emails.participant_source", lambda: source)
    source.make = lambda id, name, email, college="Example College", eligible=True, disqualified=False: SheetParticipant(
        id=id, full_name=name, email=email, college=college, certificate_eligible=eligible, is_disqualified=disqualified)
    return source
