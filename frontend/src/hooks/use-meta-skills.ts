import { useQuery } from "@tanstack/react-query";
import {
  getMetaSkillResources,
  fetchMetaSkillResourceContent,
} from "@/api/meta-skills";

export const metaSkillKeys = {
  resources: (skillType: string) =>
    ["meta-skills", skillType, "resources"] as const,
  resourceContent: (
    skillType: string,
    resourceType: string,
    filename: string,
  ) =>
    ["meta-skills", skillType, "resource-content", resourceType, filename] as const,
};

export function useMetaSkillResources(skillType: string) {
  return useQuery({
    queryKey: metaSkillKeys.resources(skillType),
    queryFn: () => getMetaSkillResources(skillType),
  });
}

export function useMetaSkillResourceContent(
  skillType: string,
  resourceType: string,
  filename: string,
  enabled = true,
) {
  return useQuery({
    queryKey: metaSkillKeys.resourceContent(skillType, resourceType, filename),
    queryFn: () =>
      fetchMetaSkillResourceContent(skillType, resourceType, filename),
    enabled: enabled && !!filename,
  });
}
