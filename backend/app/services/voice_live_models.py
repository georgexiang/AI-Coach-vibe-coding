"""Voice Live supported generative AI models.

Defines the full list of models available for Voice Live sessions in the
Azure AI Foundry Voice Live API. Each HCP profile can select a different
model for their Voice Live sessions.

Verified from Azure docs 2026-04-03.
"""

VOICE_LIVE_MODELS: dict[str, dict[str, str]] = {
    "gpt-realtime": {
        "tier": "pro",
        "label": "GPT Realtime",
        "description": "GPT real-time + Azure TTS",
    },
    "gpt-4o": {
        "tier": "pro",
        "label": "GPT-4o",
        "description": "GPT-4o + Azure STT/TTS",
    },
    "gpt-4.1": {
        "tier": "pro",
        "label": "GPT-4.1",
        "description": "GPT-4.1 + Azure STT/TTS",
    },
    "gpt-5": {
        "tier": "pro",
        "label": "GPT-5",
        "description": "GPT-5 + Azure STT/TTS",
    },
    "gpt-5-chat": {
        "tier": "pro",
        "label": "GPT-5 Chat",
        "description": "GPT-5 chat + Azure STT/TTS",
    },
    "gpt-realtime-mini": {
        "tier": "basic",
        "label": "GPT Realtime Mini",
        "description": "GPT mini real-time + Azure TTS",
    },
    "gpt-4o-mini": {
        "tier": "basic",
        "label": "GPT-4o Mini",
        "description": "GPT-4o mini + Azure STT/TTS",
    },
    "gpt-4.1-mini": {
        "tier": "basic",
        "label": "GPT-4.1 Mini",
        "description": "GPT-4.1 mini + Azure STT/TTS",
    },
    "gpt-5-mini": {
        "tier": "basic",
        "label": "GPT-5 Mini",
        "description": "GPT-5 mini + Azure STT/TTS",
    },
    "gpt-5-nano": {
        "tier": "lite",
        "label": "GPT-5 Nano",
        "description": "GPT-5 nano + Azure STT/TTS",
    },
    "phi4-mm-realtime": {
        "tier": "lite",
        "label": "Phi4-MM Realtime",
        "description": "Phi4-mm realtime + Azure TTS",
    },
    "phi4-mini": {
        "tier": "lite",
        "label": "Phi4 Mini",
        "description": "Phi4-mini + Azure STT/TTS",
    },
}

VOICE_LIVE_MODEL_TIERS = ["pro", "basic", "lite"]
