"""Azure endpoint URL utilities shared across Voice Live modules."""

import re


def to_cognitive_services_endpoint(endpoint: str) -> str:
    """Transform AI Foundry endpoint to Cognitive Services endpoint for Voice Live.

    Voice Live WebSocket (/voice-agent/realtime) requires the cognitiveservices
    domain. The AI Foundry services.ai.azure.com endpoint returns 404 for this path.

    Examples:
        https://foo.services.ai.azure.com/ -> https://foo.cognitiveservices.azure.com/
        https://foo.cognitiveservices.azure.com/ -> unchanged
        https://foo.openai.azure.com/ -> unchanged
    """
    return re.sub(
        r"\.services\.ai\.azure\.com",
        ".cognitiveservices.azure.com",
        endpoint,
    )
