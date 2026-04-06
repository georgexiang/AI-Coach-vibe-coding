"""Azure TTS Avatar character metadata.

Canonical list of pre-built avatar characters available in Azure AI Speech.
The frontend uses this data to render the avatar selection grid.

Thumbnail URLs point to the official Microsoft Learn documentation CDN, which
hosts real preview photos for each avatar character. These are publicly
accessible PNG images.

Characters are divided into two types:
  - **Video avatars**: Have multiple style variants (e.g. Lisa casual-sitting,
    Harry business). Rendered via WebRTC H.264 video stream.
  - **Photo avatars**: Single character, no style variants. Rendered via VASA-1
    model. Identified by ``is_photo_avatar=True``.
"""

from typing import Any

# CDN base URL for official Azure avatar preview images
_CDN_BASE = (
    "https://learn.microsoft.com/en-us/azure/ai-services/"
    "speech-service/text-to-speech-avatar/media"
)

# ── Video Avatar Characters ─────────────────────────────────────────────
# These have multiple style variants and use the standard video avatar engine.
# Thumbnail URL pattern: {CDN_BASE}/{character}-{default_style}.png

AVATAR_VIDEO_CHARACTERS: list[dict[str, Any]] = [
    {
        "id": "lisa",
        "display_name": "Lisa",
        "gender": "female",
        "is_photo_avatar": False,
        "styles": [
            {"id": "casual-sitting", "display_name": "Casual Sitting"},
            {"id": "graceful-sitting", "display_name": "Graceful Sitting"},
            {"id": "graceful-standing", "display_name": "Graceful Standing"},
            {"id": "technical-sitting", "display_name": "Technical Sitting"},
            {"id": "technical-standing", "display_name": "Technical Standing"},
        ],
        "default_style": "casual-sitting",
        "thumbnail_url": f"{_CDN_BASE}/lisa-casual-sitting.png",
    },
    {
        "id": "harry",
        "display_name": "Harry",
        "gender": "male",
        "is_photo_avatar": False,
        "styles": [
            {"id": "business", "display_name": "Business"},
            {"id": "casual", "display_name": "Casual"},
            {"id": "youthful", "display_name": "Youthful"},
        ],
        "default_style": "casual",
        "thumbnail_url": f"{_CDN_BASE}/harry-casual.png",
    },
    {
        "id": "meg",
        "display_name": "Meg",
        "gender": "female",
        "is_photo_avatar": False,
        "styles": [
            {"id": "formal", "display_name": "Formal"},
            {"id": "casual", "display_name": "Casual"},
            {"id": "business", "display_name": "Business"},
        ],
        "default_style": "formal",
        "thumbnail_url": f"{_CDN_BASE}/meg-formal.png",
    },
    {
        "id": "jeff",
        "display_name": "Jeff",
        "gender": "male",
        "is_photo_avatar": False,
        "styles": [
            {"id": "business", "display_name": "Business"},
            {"id": "formal", "display_name": "Formal"},
        ],
        "default_style": "business",
        "thumbnail_url": f"{_CDN_BASE}/jeff-business.png",
    },
    {
        "id": "lori",
        "display_name": "Lori",
        "gender": "female",
        "is_photo_avatar": False,
        "styles": [
            {"id": "casual", "display_name": "Casual"},
            {"id": "graceful", "display_name": "Graceful"},
            {"id": "formal", "display_name": "Formal"},
        ],
        "default_style": "casual",
        "thumbnail_url": f"{_CDN_BASE}/lori-casual.png",
    },
    {
        "id": "max",
        "display_name": "Max",
        "gender": "male",
        "is_photo_avatar": False,
        "styles": [
            {"id": "business", "display_name": "Business"},
            {"id": "casual", "display_name": "Casual"},
            {"id": "formal", "display_name": "Formal"},
        ],
        "default_style": "business",
        "thumbnail_url": f"{_CDN_BASE}/max-business.png",
    },
]

# ── Photo Avatar Characters ─────────────────────────────────────────────
# These use the VASA-1 model, have no style variants, and are identified
# by is_photo_avatar=True. Thumbnail URL pattern varies:
#   Some use {CDN_BASE}/{character}.png
#   Some use {CDN_BASE}/{character}-avatar.png

AVATAR_PHOTO_CHARACTERS: list[dict[str, Any]] = [
    {
        "id": "adrian",
        "display_name": "Adrian",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/adrian.png",
    },
    {
        "id": "amara",
        "display_name": "Amara",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/amara.png",
    },
    {
        "id": "amira",
        "display_name": "Amira",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/amira-avatar.png",
    },
    {
        "id": "anika",
        "display_name": "Anika",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/anika-avatar.png",
    },
    {
        "id": "bianca",
        "display_name": "Bianca",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/bianca.png",
    },
    {
        "id": "camila",
        "display_name": "Camila",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/camila.png",
    },
    {
        "id": "carlos",
        "display_name": "Carlos",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/carlos.png",
    },
    {
        "id": "clara",
        "display_name": "Clara",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/clara.png",
    },
    {
        "id": "darius",
        "display_name": "Darius",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/darius.png",
    },
    {
        "id": "diego",
        "display_name": "Diego",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/diego.png",
    },
    {
        "id": "elise",
        "display_name": "Elise",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/elise.png",
    },
    {
        "id": "farhan",
        "display_name": "Farhan",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/farhan-avatar.png",
    },
    {
        "id": "faris",
        "display_name": "Faris",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/faris-avatar.png",
    },
    {
        "id": "gabrielle",
        "display_name": "Gabrielle",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/gabrielle.png",
    },
    {
        "id": "hyejin",
        "display_name": "Hyejin",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/hyejin-avatar.png",
    },
    {
        "id": "imran",
        "display_name": "Imran",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/imran-avatar.png",
    },
    {
        "id": "isabella",
        "display_name": "Isabella",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/isabella.png",
    },
    {
        "id": "layla",
        "display_name": "Layla",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/layla.png",
    },
    {
        "id": "liwei",
        "display_name": "Liwei",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/liwei-avatar.png",
    },
    {
        "id": "ling",
        "display_name": "Ling",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/ling.png",
    },
    {
        "id": "marcus",
        "display_name": "Marcus",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/marcus.png",
    },
    {
        "id": "matteo",
        "display_name": "Matteo",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/matteo.png",
    },
    {
        "id": "rahul",
        "display_name": "Rahul",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/rahul-avatar.png",
    },
    {
        "id": "rana",
        "display_name": "Rana",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/rana.png",
    },
    {
        "id": "ren",
        "display_name": "Ren",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/ren-avatar.png",
    },
    {
        "id": "riya",
        "display_name": "Riya",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/riya-avatar.png",
    },
    {
        "id": "sakura",
        "display_name": "Sakura",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/sakura-avatar.png",
    },
    {
        "id": "simone",
        "display_name": "Simone",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/simone.png",
    },
    {
        "id": "zayd",
        "display_name": "Zayd",
        "gender": "male",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/zayd-avatar.png",
    },
    {
        "id": "zoe",
        "display_name": "Zoe",
        "gender": "female",
        "is_photo_avatar": True,
        "styles": [],
        "default_style": "",
        "thumbnail_url": f"{_CDN_BASE}/zoe.png",
    },
]

# Combined list: video avatars first, then photo avatars
AVATAR_CHARACTERS: list[dict[str, Any]] = AVATAR_VIDEO_CHARACTERS + AVATAR_PHOTO_CHARACTERS


def get_avatar_characters_list(api_prefix: str = "/api/v1") -> list[dict[str, Any]]:
    """Return avatar character metadata with CDN thumbnail URLs.

    All thumbnails point to the official Microsoft Learn documentation CDN.

    Args:
        api_prefix: Kept for backward compatibility (no longer used).

    Returns:
        List of character metadata dicts ready for API response serialization.
    """
    return [
        {
            "id": char["id"],
            "display_name": char["display_name"],
            "gender": char["gender"],
            "is_photo_avatar": char.get("is_photo_avatar", False),
            "styles": char["styles"],
            "default_style": char["default_style"],
            "thumbnail_url": char["thumbnail_url"],
        }
        for char in AVATAR_CHARACTERS
    ]


# ── Quick lookup map ────────────────────────────────────────────────────

_AVATAR_MAP: dict[str, dict[str, Any]] = {c["id"]: c for c in AVATAR_CHARACTERS}


def lookup_avatar(character_id: str) -> dict[str, Any] | None:
    """Look up avatar character metadata by ID. Returns None if not found."""
    return _AVATAR_MAP.get(character_id)


def is_photo_avatar(character_id: str) -> bool:
    """Return True if the character is a photo avatar (VASA-1)."""
    char = _AVATAR_MAP.get(character_id)
    return bool(char and char.get("is_photo_avatar", False))


def validate_avatar_style(character_id: str, style: str) -> str | None:
    """Validate that style is valid for this character.

    Returns the style if valid, or the character's default_style if invalid.
    Returns None if character not found.
    """
    char = _AVATAR_MAP.get(character_id)
    if not char:
        return None
    if char.get("is_photo_avatar"):
        # Photo avatars don't have styles
        return ""
    valid_styles = {s["id"] for s in char.get("styles", [])}
    if style in valid_styles:
        return style
    return char.get("default_style", "")
