"""Integration test fixtures: real Azure credentials from environment.

These tests bypass mocks and call real Azure APIs. They skip gracefully
when credentials are not in the environment (safe for CI and offline dev).
"""

import os

import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "integration: mark test as requiring real Azure credentials")
    config.addinivalue_line(
        "markers", "timeout: per-test timeout in seconds (requires pytest-timeout plugin)"
    )


def has_azure_openai_credentials() -> bool:
    return bool(
        os.environ.get("AZURE_OPENAI_ENDPOINT")
        and os.environ.get("AZURE_OPENAI_API_KEY")
        and os.environ.get("AZURE_OPENAI_DEPLOYMENT")
    )


def has_azure_speech_credentials() -> bool:
    return bool(os.environ.get("AZURE_SPEECH_KEY") and os.environ.get("AZURE_SPEECH_REGION"))


def has_azure_voice_live_credentials() -> bool:
    return bool(
        os.environ.get("AZURE_VOICE_LIVE_ENDPOINT")
        and os.environ.get("AZURE_VOICE_LIVE_API_KEY")
        and os.environ.get("AZURE_VOICE_LIVE_REGION")
    )


def speech_sdk_available() -> bool:
    try:
        import azure.cognitiveservices.speech  # noqa: F401

        return True
    except ImportError:
        return False


skip_no_openai = pytest.mark.skipif(
    not has_azure_openai_credentials(),
    reason=(
        "Azure OpenAI credentials not set "
        "(AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT)"
    ),
)

skip_no_speech = pytest.mark.skipif(
    not has_azure_speech_credentials(),
    reason="Azure Speech credentials not set (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)",
)

skip_no_speech_sdk = pytest.mark.skipif(
    not speech_sdk_available(),
    reason="azure-cognitiveservices-speech package not installed (pip install -e '.[voice]')",
)

skip_no_voice_live = pytest.mark.skipif(
    not has_azure_voice_live_credentials(),
    reason=(
        "Voice Live credentials not set "
        "(AZURE_VOICE_LIVE_ENDPOINT, AZURE_VOICE_LIVE_API_KEY, AZURE_VOICE_LIVE_REGION)"
    ),
)
