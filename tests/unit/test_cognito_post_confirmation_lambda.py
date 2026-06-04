import sys
from pathlib import Path
SERVICE_DIR = Path(__file__).resolve().parents[2] / "services"
sys.path.insert(0, str(SERVICE_DIR))

import pytest
from unittest.mock import MagicMock
import os
import importlib

@pytest.fixture
def mock_env(monkeypatch):
    monkeypatch.setenv("ALLOWED_APP_CLIENT_ID", "test-client-id")
    if "cognito_post_confirmation.lambda_function" in sys.modules:
        del sys.modules["cognito_post_confirmation.lambda_function"]
    import cognito_post_confirmation.lambda_function as lambda_main
    return lambda_main

@pytest.fixture
def mock_cognito(monkeypatch, mock_env):
    mock_client = MagicMock()
    monkeypatch.setattr(mock_env, "cognito", mock_client)
    return mock_client, mock_env

def test_valid_post_confirmation_signup(mock_cognito):
    mock_client, lambda_main = mock_cognito
    event = {"triggerSource": "PostConfirmation_ConfirmSignUp", "callerContext": {"clientId": "test-client-id"}, "userPoolId": "us-east-1_test", "userName": "testuser"}
    result = lambda_main.lambda_handler(event, None)
    mock_client.admin_add_user_to_group.assert_called_once_with(UserPoolId="us-east-1_test", Username="testuser", GroupName="Passenger")
    assert result == event

def test_non_signup_trigger_ignored(mock_cognito):
    mock_client, lambda_main = mock_cognito
    event = {"triggerSource": "PostConfirmation_ConfirmForgotPassword", "callerContext": {"clientId": "test-client-id"}, "userPoolId": "us-east-1_test", "userName": "testuser"}
    result = lambda_main.lambda_handler(event, None)
    mock_client.admin_add_user_to_group.assert_not_called()

def test_unexpected_client_id_ignored(mock_cognito):
    mock_client, lambda_main = mock_cognito
    event = {"triggerSource": "PostConfirmation_ConfirmSignUp", "callerContext": {"clientId": "rogue-client-id"}, "userPoolId": "us-east-1_test", "userName": "testuser"}
    result = lambda_main.lambda_handler(event, None)
    mock_client.admin_add_user_to_group.assert_not_called()
