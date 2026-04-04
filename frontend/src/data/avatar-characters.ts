/**
 * Azure TTS Avatar character metadata.
 *
 * Each entry describes a pre-built avatar character available in Azure AI Speech.
 * The `thumbnailUrl` uses the Azure Speech Studio CDN pattern. If the URL is
 * unreachable, the UI falls back to a gradient circle with the character's initials.
 *
 * To add a new character: append an entry here and the avatar grid will pick it up
 * automatically.
 */

export interface AvatarCharacterMeta {
  /** Lowercase identifier used by the Azure Avatar API (e.g. "lisa"). */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Available style variants for this character. */
  styles: readonly string[];
  /** Default style to select when user first picks this character. */
  defaultStyle: string;
  /** Gender hint — used only for i18n / display labels. */
  gender: "female" | "male";
  /** Tailwind gradient classes for the fallback circle. */
  gradientClasses: string;
  /**
   * Preview thumbnail URL.
   *
   * Azure Speech Studio hosts character previews on its CDN. The exact URL
   * pattern may change; the UI shows a fallback if the image fails to load.
   */
  thumbnailUrl: string;
}

/**
 * CDN base for Azure Speech Studio avatar thumbnails.
 * This is the publicly-accessible path used by the Speech Studio web app.
 */
const AZURE_AVATAR_CDN = "https://speech.microsoft.com/assets/avatar";

/**
 * Build the canonical thumbnail URL for a character + style combo.
 * Example: https://speech.microsoft.com/assets/avatar/lisa-casual-sitting.png
 */
function avatarUrl(character: string, style: string): string {
  return `${AZURE_AVATAR_CDN}/${character}-${style}.png`;
}

/**
 * All available Azure TTS Avatar characters.
 *
 * Order matters — the grid renders them in this order.
 */
export const AVATAR_CHARACTERS: readonly AvatarCharacterMeta[] = [
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
    gradientClasses: "from-purple-500 to-purple-700",
    thumbnailUrl: avatarUrl("lisa", "casual-sitting"),
  },
  {
    id: "harry",
    displayName: "Harry",
    styles: ["business", "casual", "youthful"],
    defaultStyle: "casual",
    gender: "male",
    gradientClasses: "from-blue-500 to-blue-700",
    thumbnailUrl: avatarUrl("harry", "casual"),
  },
  {
    id: "meg",
    displayName: "Meg",
    styles: ["formal", "casual", "business"],
    defaultStyle: "formal",
    gender: "female",
    gradientClasses: "from-cyan-500 to-cyan-700",
    thumbnailUrl: avatarUrl("meg", "formal"),
  },
  {
    id: "jeff",
    displayName: "Jeff",
    styles: ["business", "formal"],
    defaultStyle: "business",
    gender: "male",
    gradientClasses: "from-emerald-500 to-emerald-700",
    thumbnailUrl: avatarUrl("jeff", "business"),
  },
  {
    id: "lori",
    displayName: "Lori",
    styles: ["casual", "graceful", "formal"],
    defaultStyle: "casual",
    gender: "female",
    gradientClasses: "from-rose-500 to-rose-700",
    thumbnailUrl: avatarUrl("lori", "casual"),
  },
  {
    id: "max",
    displayName: "Max",
    styles: ["business", "casual", "formal"],
    defaultStyle: "business",
    gender: "male",
    gradientClasses: "from-amber-500 to-amber-700",
    thumbnailUrl: avatarUrl("max", "business"),
  },
] as const;

/**
 * Quick lookup map: character id -> metadata.
 */
export const AVATAR_CHARACTER_MAP = new Map<string, AvatarCharacterMeta>(
  AVATAR_CHARACTERS.map((c) => [c.id, c]),
);

/**
 * Get the fallback initials for a character name (first letter, uppercase).
 */
export function getAvatarInitials(displayName: string): string {
  return displayName.charAt(0).toUpperCase();
}
