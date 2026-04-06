import { useQuery } from "@tanstack/react-query";
import { fetchAvatarCharacters } from "@/api/voice-live";
import type { AvatarCharactersResponse } from "@/types/voice-live";

/**
 * Fetch available Azure TTS Avatar characters from the backend API.
 *
 * Returns character metadata including thumbnail URLs pointing to
 * the official Microsoft Learn CDN (real avatar face photos).
 *
 * Data is cached for 1 hour since avatar characters rarely change.
 */
export function useAvatarCharacters() {
  return useQuery<AvatarCharactersResponse>({
    queryKey: ["avatar-characters"],
    queryFn: fetchAvatarCharacters,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
}
