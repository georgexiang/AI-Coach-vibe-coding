"""Tests for conference prompt builder functions: audience prompt and scoring prompt."""

import json

from app.models.scenario import Scenario
from app.services.prompt_builder import (
    build_conference_audience_prompt,
    build_conference_scoring_prompt,
)


def _make_scenario(**overrides) -> Scenario:
    """Create a minimal Scenario ORM instance for conference prompt tests."""
    defaults = {
        "name": "Conference Scenario",
        "product": "Brukinsa",
        "therapeutic_area": "Hematology",
        "hcp_profile_id": "profile-1",
        "key_messages": json.dumps(["Superior PFS vs ibrutinib", "Better safety profile"]),
        "weight_key_message": 30,
        "weight_objection_handling": 25,
        "weight_communication": 20,
        "weight_product_knowledge": 15,
        "weight_scientific_info": 10,
        "pass_threshold": 70,
        "created_by": "user-1",
        "mode": "conference",
        "status": "active",
    }
    defaults.update(overrides)
    return Scenario(**defaults)


class TestBuildConferenceAudiencePrompt:
    """Tests for build_conference_audience_prompt."""

    def test_includes_hcp_identity(self):
        """Prompt contains the HCP name and specialty."""
        hcp_config = {
            "name": "Li Ming",
            "specialty": "Cardiology",
            "personality_type": "analytical",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="Brukinsa efficacy data",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "Dr. Li Ming" in prompt
        assert "Cardiology" in prompt
        assert "audience member" in prompt

    def test_includes_personality_instruction_skeptical(self):
        """Skeptical personality triggers demand-evidence instruction."""
        hcp_config = {
            "name": "Chen Wei",
            "specialty": "Oncology",
            "personality_type": "skeptical",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "SKEPTICAL" in prompt
        assert "demand evidence" in prompt

    def test_includes_personality_instruction_friendly(self):
        """Friendly personality triggers curious follow-up instruction."""
        hcp_config = {
            "name": "Wang Fang",
            "specialty": "Neurology",
            "personality_type": "friendly",
            "role": "panelist",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "FRIENDLY" in prompt

    def test_unknown_personality_uses_default(self):
        """Unknown personality type gets professional demeanor default."""
        hcp_config = {
            "name": "Test",
            "specialty": "General",
            "personality_type": "unknown_type",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "professional demeanor" in prompt

    def test_includes_product_from_scenario(self):
        """Prompt mentions the product from the scenario."""
        hcp_config = {
            "name": "Test",
            "specialty": "Oncology",
            "personality_type": "friendly",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(product="Tislelizumab"),
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "Tislelizumab" in prompt

    def test_includes_therapeutic_area_when_present(self):
        """Prompt includes therapeutic area from scenario."""
        hcp_config = {
            "name": "Test",
            "specialty": "Oncology",
            "personality_type": "friendly",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(therapeutic_area="Hematology"),
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "Hematology" in prompt

    def test_includes_presentation_topic(self):
        """Prompt includes the presentation topic when provided."""
        hcp_config = {
            "name": "Test",
            "specialty": "Oncology",
            "personality_type": "friendly",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="New PFS data for CLL patients",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "New PFS data for CLL patients" in prompt

    def test_includes_conversation_history(self):
        """Prompt includes recent conversation history."""
        hcp_config = {
            "name": "Test",
            "specialty": "Oncology",
            "personality_type": "friendly",
            "role": "audience",
        }
        history = [
            {"role": "user", "content": "Welcome to my presentation", "speaker_name": ""},
            {
                "role": "assistant",
                "content": "What about safety?",
                "speaker_name": "Dr. Chen",
            },
        ]
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="",
            conversation_history=history,
            other_hcp_questions=[],
        )

        assert "Welcome to my presentation" in prompt
        assert "Dr. Chen" in prompt
        assert "What about safety?" in prompt

    def test_includes_other_hcp_questions_for_deduplication(self):
        """Prompt lists other HCPs' questions and instructs not to repeat."""
        hcp_config = {
            "name": "Test",
            "specialty": "Oncology",
            "personality_type": "friendly",
            "role": "audience",
        }
        other_questions = [
            {"hcp_name": "Dr. Zhang", "question": "What is the PFS data?"},
        ]
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=other_questions,
        )

        assert "Dr. Zhang" in prompt
        assert "What is the PFS data?" in prompt
        assert "Do NOT repeat" in prompt

    def test_no_scenario_uses_fallback_product(self):
        """When scenario is None, 'the product' is used as fallback."""
        hcp_config = {
            "name": "Test",
            "specialty": "General",
            "personality_type": "friendly",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=None,
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "the product" in prompt

    def test_includes_instructions_section(self):
        """Prompt contains the instructions section for question generation."""
        hcp_config = {
            "name": "Test",
            "specialty": "General",
            "personality_type": "friendly",
            "role": "audience",
        }
        prompt = build_conference_audience_prompt(
            hcp_config=hcp_config,
            scenario=_make_scenario(),
            presentation_topic="",
            conversation_history=[],
            other_hcp_questions=[],
        )

        assert "generate a relevant question" in prompt
        assert "Do NOT provide coaching feedback" in prompt


class TestBuildConferenceScoringPrompt:
    """Tests for build_conference_scoring_prompt."""

    def test_includes_audience_info(self):
        """Prompt lists audience HCPs with name, specialty, personality."""
        scenario = _make_scenario()
        audience = [
            {"name": "Li Ming", "specialty": "Oncology", "personality_type": "skeptical"},
            {"name": "Wang Fang", "specialty": "Cardiology", "personality_type": "friendly"},
        ]
        prompt = build_conference_scoring_prompt(scenario, [], audience)

        assert "Dr. Li Ming" in prompt
        assert "Oncology" in prompt
        assert "skeptical" in prompt
        assert "Dr. Wang Fang" in prompt
        assert "Cardiology" in prompt

    def test_includes_conference_adapted_dimensions(self):
        """Prompt uses conference-adapted dimension names."""
        scenario = _make_scenario()
        prompt = build_conference_scoring_prompt(scenario, [], [])

        assert "Presentation Completeness" in prompt
        assert "Q&A Handling" in prompt
        assert "Presentation Delivery" in prompt
        assert "Product Knowledge" in prompt
        assert "Scientific Rigor" in prompt

    def test_includes_weights_from_scenario(self):
        """Prompt includes scoring weights from the scenario."""
        scenario = _make_scenario(
            weight_key_message=35,
            weight_objection_handling=25,
        )
        prompt = build_conference_scoring_prompt(scenario, [], [])

        assert "weight: 35" in prompt
        assert "weight: 25" in prompt

    def test_includes_key_messages_from_scenario(self):
        """Prompt includes key messages parsed from scenario JSON."""
        scenario = _make_scenario(
            key_messages=json.dumps(["PFS superiority", "Safety advantage"])
        )
        prompt = build_conference_scoring_prompt(scenario, [], [])

        assert "PFS superiority" in prompt
        assert "Safety advantage" in prompt

    def test_formats_transcript_with_speaker_attribution(self):
        """Transcript labels MR messages and HCP messages with speaker name."""
        scenario = _make_scenario()
        messages = [
            {"role": "user", "content": "Good morning everyone", "speaker_name": ""},
            {
                "role": "assistant",
                "content": "What about side effects?",
                "speaker_name": "Dr. Chen",
            },
            {"role": "user", "content": "Great question", "speaker_name": ""},
        ]
        prompt = build_conference_scoring_prompt(scenario, messages, [])

        assert "MR: Good morning everyone" in prompt
        assert "HCP (Dr. Chen): What about side effects?" in prompt
        assert "MR: Great question" in prompt

    def test_assistant_without_speaker_name_labeled_hcp(self):
        """Assistant messages without speaker_name get generic HCP label."""
        scenario = _make_scenario()
        messages = [
            {"role": "assistant", "content": "A question", "speaker_name": ""},
        ]
        prompt = build_conference_scoring_prompt(scenario, messages, [])

        assert "HCP: A question" in prompt

    def test_requires_json_output(self):
        """Prompt instructs to return JSON in standard scoring format."""
        scenario = _make_scenario()
        prompt = build_conference_scoring_prompt(scenario, [], [])

        assert "Return ONLY valid JSON" in prompt
        assert "key_message" in prompt
        assert "objection_handling" in prompt
