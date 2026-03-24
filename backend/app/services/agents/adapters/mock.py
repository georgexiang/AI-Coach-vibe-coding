"""Enhanced mock adapter with personality-based template responses."""

import random
from collections.abc import AsyncIterator

from app.services.agents.base import (
    BaseCoachingAdapter,
    CoachEvent,
    CoachEventType,
    CoachRequest,
)

# Template responses organized by personality type and conversation phase
PERSONALITY_TEMPLATES: dict[str, dict[str, list[str]]] = {
    "skeptical": {
        "opening": [
            "I'm quite busy today. What about {product}?",
            ("I've heard about {product} before, but I'm not convinced by what I've seen so far."),
            "I'm not easily persuaded by marketing materials. Go ahead.",
        ],
        "middle": [
            "That's an interesting claim. Do you have hard data?",
            "I've seen similar claims. What makes {product} different?",
            "My patients do well on current treatments. Why switch?",
            "Numbers look good on paper. What about real-world data?",
            "I'd need head-to-head comparison data first.",
        ],
        "closing": [
            "I'll look at the data, but I remain skeptical.",
            "Send me the published studies. I'll review them.",
            (
                "I appreciate your thoroughness, but I need "
                "more evidence before changing my approach."
            ),
        ],
    },
    "friendly": {
        "opening": [
            "Hello! I've been curious about {product} actually.",
            ("Welcome! I enjoy learning about new options. Tell me about {product}."),
            "Nice to meet you. I'm open to hearing about {product}.",
        ],
        "middle": [
            "Interesting! Tell me more about the clinical trials.",
            "How does {product} compare to what I'm currently using?",
            "My patients could benefit. What about the safety profile?",
            "Good point. Some patients struggle with current options.",
            "The efficacy data sounds promising. Long-term outcomes?",
        ],
        "closing": [
            ("Thank you. I'm quite interested in trying {product} with some patients."),
            ("I'll consider {product} for my next suitable patient. Leave me some materials?"),
            "Very informative. I look forward to learning more.",
        ],
    },
    "busy": {
        "opening": [
            "I only have a few minutes. What about {product}?",
            "Make it quick. What's {product}?",
            "I'm between patients. Be brief about {product}.",
        ],
        "middle": [
            "Get to the point.",
            "And the bottom line is?",
            "Quickly, what's the key benefit?",
            "I don't have time for details. Summary?",
            "Next point, please.",
        ],
        "closing": [
            "Alright, I need to go. Leave the materials.",
            "Got it. I'll look at it later.",
            "Time's up. Send me an email with the key points.",
        ],
    },
    "analytical": {
        "opening": [
            "Let's discuss {product} from a data-driven perspective.",
            ("I focus on evidence-based medicine. Tell me about {product}."),
            "I want the numbers behind {product}. What do trials show?",
        ],
        "middle": [
            "What was the p-value for the primary endpoint?",
            "Can you share the NNT compared to standard of care?",
            "What about confidence intervals? Clinically meaningful?",
            "Study design: double-blind, randomized?",
            "How does the effect size compare with existing options?",
        ],
        "closing": [
            "Statistically interesting. I'll review the publications.",
            "Send me study protocols and results for my analysis.",
            "Good data. Let me review before making conclusions.",
        ],
    },
    "cautious": {
        "opening": [
            "I'm careful about new treatments. What about safety?",
            ("Patient safety is my top priority. Let's discuss {product}'s risks."),
            "Tell me about {product}'s adverse events first.",
        ],
        "middle": [
            "What about drug interactions? My patients take many meds.",
            "Any post-marketing safety signals I should know about?",
            "I'm concerned about switching stable patients.",
            "Long-term safety data? These patients need years of care.",
            "Are there any contraindications I should be aware of?",
        ],
        "closing": [
            "I'll start cautiously with lower-risk patients.",
            "I need to think carefully. Patient safety comes first.",
            ("I'll review the safety data before considering changes to my practice."),
        ],
    },
}

# Coaching hint templates
COACHING_HINTS: list[dict[str, str]] = [
    {
        "content": "Reference specific clinical trial data.",
        "dimension": "scientific_info",
    },
    {
        "content": "Address the concern before presenting counter-evidence.",
        "dimension": "objection_handling",
    },
    {
        "content": "Good opportunity to deliver a key message.",
        "dimension": "key_message",
    },
    {
        "content": "Adapt your style to match the HCP's preferences.",
        "dimension": "communication",
    },
    {
        "content": "Discuss the mechanism of action for deeper knowledge.",
        "dimension": "product_knowledge",
    },
]


class MockCoachingAdapter(BaseCoachingAdapter):
    """Mock adapter for development and testing without AI credentials.

    Provides personality-based template responses with conversation phase
    awareness (opening, middle, closing). Yields word chunks for simulated
    streaming and occasional coaching hints.
    """

    name = "mock"

    async def execute(self, request: CoachRequest) -> AsyncIterator[CoachEvent]:
        """Execute a mock coaching interaction."""
        # Fall back to simple response if no HCP profile
        if request.hcp_profile is None:
            yield CoachEvent(
                type=CoachEventType.TEXT,
                content=(
                    "[Mock HCP Response] Thank you for your "
                    "presentation about the treatment. I have "
                    "some concerns about the side effects "
                    "you mentioned. Could you elaborate on "
                    "the long-term safety data?"
                ),
            )
            yield CoachEvent(
                type=CoachEventType.SUGGESTION,
                content=("Try to address safety concerns with specific clinical trial data."),
                metadata={"dimension": "objection_handling"},
            )
            yield CoachEvent(type=CoachEventType.DONE, content="")
            return

        personality = request.hcp_profile.get("personality_type", "friendly")
        product = self._extract_product(request.scenario_context)

        # Determine conversation phase
        phase = self._determine_phase(request.message)

        # Select and personalize response
        response = self._select_response(personality, phase, product)

        # Yield response in word chunks (2-3 words) for streaming
        words = response.split()
        chunk_size = random.randint(2, 3)
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i : i + chunk_size])
            if i + chunk_size < len(words):
                chunk += " "
            yield CoachEvent(type=CoachEventType.TEXT, content=chunk)

        # Occasionally yield a coaching hint (30% chance)
        if random.random() < 0.3:
            hint = random.choice(COACHING_HINTS)
            yield CoachEvent(
                type=CoachEventType.SUGGESTION,
                content=hint["content"],
                metadata={"dimension": hint["dimension"]},
            )

        yield CoachEvent(type=CoachEventType.DONE, content="")

    async def is_available(self) -> bool:
        return True

    async def get_version(self) -> str | None:
        return "mock-2.0"

    def _extract_product(self, scenario_context: str) -> str:
        """Extract product name from scenario context."""
        for line in scenario_context.split("\n"):
            if "Product under discussion:" in line:
                return line.split(":", 1)[1].strip()
        return "the product"

    def _determine_phase(self, message: str) -> str:
        """Determine conversation phase from message characteristics."""
        lower_msg = message.lower()
        opening_indicators = [
            "hello",
            "hi ",
            "good morning",
            "good afternoon",
            "nice to meet",
            "introduce",
            "i'd like to talk",
            "i'm here to discuss",
        ]
        closing_indicators = [
            "thank you for your time",
            "in summary",
            "to conclude",
            "any final",
            "before i go",
            "last question",
            "wrap up",
            "anything else",
        ]

        if any(ind in lower_msg for ind in opening_indicators):
            return "opening"
        if any(ind in lower_msg for ind in closing_indicators):
            return "closing"
        return "middle"

    def _select_response(self, personality: str, phase: str, product: str) -> str:
        """Select a personality-appropriate response."""
        templates = PERSONALITY_TEMPLATES.get(personality, PERSONALITY_TEMPLATES["friendly"])
        phase_templates = templates.get(phase, templates["middle"])
        response = random.choice(phase_templates)
        return response.replace("{product}", product)
