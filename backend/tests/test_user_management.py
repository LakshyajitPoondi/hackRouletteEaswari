from app.auth.security import verify_password
from app.models import Role


def test_super_admin_disables_other_user(client, db, make_user, login):
    actor = make_user(Role.SUPER_ADMIN, "owner@example.com")
    target = make_user(Role.ADMIN, "admin@example.com")
    login(actor.email)
    response = client.delete(f"/api/admin/users/{target.id}")
    assert response.status_code == 204
    db.refresh(target)
    assert target.is_active is False
    assert client.post("/api/auth/login", json={"email": target.email, "password": "strong-test-password-123"}).status_code == 401


def test_cannot_disable_self_or_final_super_admin(client, db, make_user, login):
    actor = make_user(Role.SUPER_ADMIN, "owner@example.com")
    login(actor.email)
    assert client.delete(f"/api/admin/users/{actor.id}").status_code == 400
    other = make_user(Role.SUPER_ADMIN, "other@example.com")
    assert client.delete(f"/api/admin/users/{other.id}").status_code == 204
    db.refresh(actor)
    assert actor.is_active is True
    assert client.delete(f"/api/admin/users/{actor.id}").status_code == 400


def test_non_super_admin_cannot_disable_users(client, make_user, login):
    target = make_user(Role.SUPER_ADMIN, "owner@example.com")
    for role in (Role.ADMIN, Role.STAFF):
        actor = make_user(role, f"{role.value.lower()}@example.com")
        login(actor.email)
        assert client.delete(f"/api/admin/users/{target.id}").status_code == 403


def test_change_own_password(client, db, make_user, login):
    user = make_user(Role.ADMIN, "admin@example.com")
    login(user.email)
    payload = {"current_password": "strong-test-password-123", "new_password": "another-strong-password-456", "confirm_new_password": "another-strong-password-456"}
    assert client.post("/api/auth/change-password", json={**payload, "current_password": "wrong"}).json()["detail"] == "Current password is incorrect"
    assert client.post("/api/auth/change-password", json={**payload, "confirm_new_password": "different-password-456"}).json()["detail"] == "New passwords do not match"
    assert client.post("/api/auth/change-password", json={**payload, "new_password": "short", "confirm_new_password": "short"}).json()["detail"] == "Password is too short (minimum 12 characters)"
    assert client.post("/api/auth/change-password", json=payload).status_code == 204
    db.refresh(user)
    assert user.password_hash != payload["new_password"]
    assert verify_password(payload["new_password"], user.password_hash)
    assert client.post("/api/auth/login", json={"email": user.email, "password": payload["current_password"]}).status_code == 401
    assert client.post("/api/auth/login", json={"email": user.email, "password": payload["new_password"]}).status_code == 200
