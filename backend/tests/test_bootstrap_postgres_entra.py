"""Tests for PostgreSQL Entra bootstrap helpers."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from azure.core.exceptions import ClientAuthenticationError

from scripts import bootstrap_postgres_entra


def test_get_postgres_token_uses_default_credential():
    mock_credential = MagicMock()
    mock_credential.get_token.return_value = SimpleNamespace(token="dac-token")

    with patch.object(
        bootstrap_postgres_entra,
        "DefaultAzureCredential",
        return_value=mock_credential,
    ):
        token = bootstrap_postgres_entra._get_postgres_token()

    assert token == "dac-token"
    mock_credential.get_token.assert_called_once_with(bootstrap_postgres_entra.POSTGRES_SCOPE)


def test_get_postgres_token_falls_back_to_azure_cli():
    mock_credential = MagicMock()
    mock_credential.get_token.side_effect = ClientAuthenticationError("no local credential")
    completed = SimpleNamespace(
        returncode=0,
        stdout=json.dumps({"accessToken": "cli-token"}),
        stderr="",
    )

    with (
        patch.object(
            bootstrap_postgres_entra,
            "DefaultAzureCredential",
            return_value=mock_credential,
        ),
        patch.object(bootstrap_postgres_entra.subprocess, "run", return_value=completed) as run,
    ):
        token = bootstrap_postgres_entra._get_postgres_token()

    assert token == "cli-token"
    run.assert_called_once()
    assert "--resource" in run.call_args.args[0]
    assert bootstrap_postgres_entra.POSTGRES_RESOURCE in run.call_args.args[0]


def test_get_postgres_token_exits_when_azure_cli_fails():
    mock_credential = MagicMock()
    mock_credential.get_token.side_effect = ClientAuthenticationError("no local credential")
    completed = SimpleNamespace(returncode=1, stdout="", stderr="az failed")

    with (
        patch.object(
            bootstrap_postgres_entra,
            "DefaultAzureCredential",
            return_value=mock_credential,
        ),
        patch.object(bootstrap_postgres_entra.subprocess, "run", return_value=completed),
    ):
        with pytest.raises(SystemExit, match="Azure CLI could not get"):
            bootstrap_postgres_entra._get_postgres_token()
