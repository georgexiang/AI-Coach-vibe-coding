/**
 * Azure TTS Avatar character metadata.
 *
 * Each entry describes a pre-built avatar character available in Azure AI Speech.
 *
 * Thumbnail URLs point to the official Microsoft Learn documentation CDN,
 * which hosts real preview photos for each avatar character.
 *
 * Characters are divided into two types:
 *   - **Video avatars**: Have multiple style variants (e.g. Lisa casual-sitting).
 *     Rendered via WebRTC H.264 video stream.
 *   - **Photo avatars**: Single character, no style variants. Rendered via VASA-1
 *     model. Identified by `isPhotoAvatar: true`.
 *
 * The canonical source of truth is the backend API `/voice-live/avatar-characters`,
 * but this file serves as the client-side fallback and provides the static data
 * needed for immediate rendering before the API response arrives.
 */

import type { AvatarCharacterInfo } from "@/types/voice-live";

export interface AvatarCharacterMeta {
  /** Lowercase identifier used by the Azure Avatar API (e.g. "lisa"). */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Available style variants for this character (empty for photo avatars). */
  styles: readonly string[];
  /** Default style to select when user first picks this character. */
  defaultStyle: string;
  /** Gender hint -- used for i18n / display labels. */
  gender: "female" | "male";
  /** Whether this is a photo avatar (VASA-1) vs video avatar. */
  isPhotoAvatar: boolean;
  /** Tailwind gradient classes for the fallback circle (when image fails to load). */
  gradientClasses: string;
  /** Preview thumbnail URL from Microsoft Learn CDN. */
  thumbnailUrl: string;
}

/** CDN base URL for official Azure avatar preview images. */
const CDN_BASE =
  "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/media";

/**
 * All available Azure TTS Avatar characters.
 *
 * Order matters -- the grid renders them in this order.
 * Video avatars first, then photo avatars.
 */
export const AVATAR_CHARACTERS: readonly AvatarCharacterMeta[] = [
  // ── Video Avatars ──────────────────────────────────────────────────
  {
    id: "lisa",
    displayName: "Lisa",
    styles: [
      "casual-sitting",
      "graceful-sitting",
      "graceful-standing",
      "technical-sitting",
      "technical-standing",
    ],
    defaultStyle: "casual-sitting",
    gender: "female",
    isPhotoAvatar: false,
    gradientClasses: "from-purple-500 to-purple-700",
    thumbnailUrl: `${CDN_BASE}/lisa-casual-sitting.png`,
  },
  {
    id: "harry",
    displayName: "Harry",
    styles: ["business", "casual", "youthful"],
    defaultStyle: "casual",
    gender: "male",
    isPhotoAvatar: false,
    gradientClasses: "from-blue-500 to-blue-700",
    thumbnailUrl: `${CDN_BASE}/harry-casual.png`,
  },
  {
    id: "meg",
    displayName: "Meg",
    styles: ["formal", "casual", "business"],
    defaultStyle: "formal",
    gender: "female",
    isPhotoAvatar: false,
    gradientClasses: "from-cyan-500 to-cyan-700",
    thumbnailUrl: `${CDN_BASE}/meg-formal.png`,
  },
  {
    id: "jeff",
    displayName: "Jeff",
    styles: ["business", "formal"],
    defaultStyle: "business",
    gender: "male",
    isPhotoAvatar: false,
    gradientClasses: "from-emerald-500 to-emerald-700",
    thumbnailUrl: `${CDN_BASE}/jeff-business.png`,
  },
  {
    id: "lori",
    displayName: "Lori",
    styles: ["casual", "graceful", "formal"],
    defaultStyle: "casual",
    gender: "female",
    isPhotoAvatar: false,
    gradientClasses: "from-rose-500 to-rose-700",
    thumbnailUrl: `${CDN_BASE}/lori-casual.png`,
  },
  {
    id: "max",
    displayName: "Max",
    styles: ["business", "casual", "formal"],
    defaultStyle: "business",
    gender: "male",
    isPhotoAvatar: false,
    gradientClasses: "from-amber-500 to-amber-700",
    thumbnailUrl: `${CDN_BASE}/max-business.png`,
  },
  // ── Photo Avatars (VASA-1) ─────────────────────────────────────────
  {
    id: "adrian",
    displayName: "Adrian",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-slate-500 to-slate-700",
    thumbnailUrl: `${CDN_BASE}/adrian.png`,
  },
  {
    id: "amara",
    displayName: "Amara",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-orange-500 to-orange-700",
    thumbnailUrl: `${CDN_BASE}/amara.png`,
  },
  {
    id: "amira",
    displayName: "Amira",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-pink-500 to-pink-700",
    thumbnailUrl: `${CDN_BASE}/amira-avatar.png`,
  },
  {
    id: "anika",
    displayName: "Anika",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-violet-500 to-violet-700",
    thumbnailUrl: `${CDN_BASE}/anika-avatar.png`,
  },
  {
    id: "bianca",
    displayName: "Bianca",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-fuchsia-500 to-fuchsia-700",
    thumbnailUrl: `${CDN_BASE}/bianca.png`,
  },
  {
    id: "camila",
    displayName: "Camila",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-teal-500 to-teal-700",
    thumbnailUrl: `${CDN_BASE}/camila.png`,
  },
  {
    id: "carlos",
    displayName: "Carlos",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-indigo-500 to-indigo-700",
    thumbnailUrl: `${CDN_BASE}/carlos.png`,
  },
  {
    id: "clara",
    displayName: "Clara",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-lime-500 to-lime-700",
    thumbnailUrl: `${CDN_BASE}/clara.png`,
  },
  {
    id: "darius",
    displayName: "Darius",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-stone-500 to-stone-700",
    thumbnailUrl: `${CDN_BASE}/darius.png`,
  },
  {
    id: "diego",
    displayName: "Diego",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-sky-500 to-sky-700",
    thumbnailUrl: `${CDN_BASE}/diego.png`,
  },
  {
    id: "elise",
    displayName: "Elise",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-red-500 to-red-700",
    thumbnailUrl: `${CDN_BASE}/elise.png`,
  },
  {
    id: "farhan",
    displayName: "Farhan",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-yellow-500 to-yellow-700",
    thumbnailUrl: `${CDN_BASE}/farhan-avatar.png`,
  },
  {
    id: "faris",
    displayName: "Faris",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-green-500 to-green-700",
    thumbnailUrl: `${CDN_BASE}/faris-avatar.png`,
  },
  {
    id: "gabrielle",
    displayName: "Gabrielle",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-purple-400 to-purple-600",
    thumbnailUrl: `${CDN_BASE}/gabrielle.png`,
  },
  {
    id: "hyejin",
    displayName: "Hyejin",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-blue-400 to-blue-600",
    thumbnailUrl: `${CDN_BASE}/hyejin-avatar.png`,
  },
  {
    id: "imran",
    displayName: "Imran",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-emerald-400 to-emerald-600",
    thumbnailUrl: `${CDN_BASE}/imran-avatar.png`,
  },
  {
    id: "isabella",
    displayName: "Isabella",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-rose-400 to-rose-600",
    thumbnailUrl: `${CDN_BASE}/isabella.png`,
  },
  {
    id: "layla",
    displayName: "Layla",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-amber-400 to-amber-600",
    thumbnailUrl: `${CDN_BASE}/layla.png`,
  },
  {
    id: "liwei",
    displayName: "Liwei",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-cyan-400 to-cyan-600",
    thumbnailUrl: `${CDN_BASE}/liwei-avatar.png`,
  },
  {
    id: "ling",
    displayName: "Ling",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-pink-400 to-pink-600",
    thumbnailUrl: `${CDN_BASE}/ling.png`,
  },
  {
    id: "marcus",
    displayName: "Marcus",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-violet-400 to-violet-600",
    thumbnailUrl: `${CDN_BASE}/marcus.png`,
  },
  {
    id: "matteo",
    displayName: "Matteo",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-teal-400 to-teal-600",
    thumbnailUrl: `${CDN_BASE}/matteo.png`,
  },
  {
    id: "rahul",
    displayName: "Rahul",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-orange-400 to-orange-600",
    thumbnailUrl: `${CDN_BASE}/rahul-avatar.png`,
  },
  {
    id: "rana",
    displayName: "Rana",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-fuchsia-400 to-fuchsia-600",
    thumbnailUrl: `${CDN_BASE}/rana.png`,
  },
  {
    id: "ren",
    displayName: "Ren",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-indigo-400 to-indigo-600",
    thumbnailUrl: `${CDN_BASE}/ren-avatar.png`,
  },
  {
    id: "riya",
    displayName: "Riya",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-lime-400 to-lime-600",
    thumbnailUrl: `${CDN_BASE}/riya-avatar.png`,
  },
  {
    id: "sakura",
    displayName: "Sakura",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-red-400 to-red-600",
    thumbnailUrl: `${CDN_BASE}/sakura-avatar.png`,
  },
  {
    id: "simone",
    displayName: "Simone",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-sky-400 to-sky-600",
    thumbnailUrl: `${CDN_BASE}/simone.png`,
  },
  {
    id: "zayd",
    displayName: "Zayd",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-stone-400 to-stone-600",
    thumbnailUrl: `${CDN_BASE}/zayd-avatar.png`,
  },
  {
    id: "zoe",
    displayName: "Zoe",
    styles: [],
    defaultStyle: "",
    gender: "female",
    isPhotoAvatar: true,
    gradientClasses: "from-yellow-400 to-yellow-600",
    thumbnailUrl: `${CDN_BASE}/zoe.png`,
  },
] as const;

/**
 * Quick lookup map: character id -> metadata.
 */
export const AVATAR_CHARACTER_MAP = new Map<string, AvatarCharacterMeta>(
  AVATAR_CHARACTERS.map((c) => [c.id, c]),
);

/**
 * Build an AvatarCharacterMeta from API response data.
 * Used to create entries from the backend avatar-characters endpoint.
 */
export function apiCharacterToMeta(
  apiChar: AvatarCharacterInfo,
): AvatarCharacterMeta {
  const existing = AVATAR_CHARACTER_MAP.get(apiChar.id);
  const gradient = existing?.gradientClasses ?? "from-gray-500 to-gray-700";
  return {
    id: apiChar.id,
    displayName: apiChar.display_name,
    styles: apiChar.styles.map((s) => s.id),
    defaultStyle: apiChar.default_style,
    gender: apiChar.gender as "female" | "male",
    isPhotoAvatar: apiChar.is_photo_avatar,
    gradientClasses: gradient,
    thumbnailUrl: apiChar.thumbnail_url,
  };
}

/**
 * Get the fallback initials for a character name (first letter, uppercase).
 */
export function getAvatarInitials(displayName: string): string {
  return displayName.charAt(0).toUpperCase();
}
