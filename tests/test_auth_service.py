import pytest

from tests.helpers import load_service_app, unique_name


pytestmark = pytest.mark.unit


def test_user_registration_works():
    client, _, _, _, _ = load_service_app("auth_service")
    username = unique_name("auth_user")

    response = client.post(
        "/register",
        params={"username": username, "password": "secret123", "role": "passenger"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["message"] == "User registered successfully"
    assert payload["username"] == username
    assert payload["role"] == "passenger"


def test_login_returns_access_token():
    client, _, _, _, _ = load_service_app("auth_service")
    username = unique_name("auth_login")

    register_response = client.post(
        "/register",
        params={"username": username, "password": "secret123", "role": "staff"},
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/login",
        data={"username": username, "password": "secret123"},
    )

    assert login_response.status_code == 200
    payload = login_response.json()
    assert payload["token_type"] == "bearer"
    assert payload["role"] == "staff"
    assert payload["access_token"]
