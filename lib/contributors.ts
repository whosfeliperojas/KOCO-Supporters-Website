import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contributor, ContributorMap } from "@/lib/types";

/**
 * Who is credited on each of these posts.
 *
 * Goes through the list_post_contributors function rather than selecting the
 * table with a join, because profiles_select only lets a volunteer read their
 * own profile row — a plain join would return the right rows with null names.
 *
 * Returns an empty map rather than throwing: a missing credit list should
 * never take down the page that shows the posts.
 */
export async function fetchContributors(
  // The server and browser clients are generated separately; only .rpc is used.
  supabase: Pick<SupabaseClient, "rpc">,
  postIds: string[],
): Promise<ContributorMap> {
  const ids = [...new Set(postIds)].filter(Boolean);
  if (ids.length === 0) return {};

  const { data, error } = await supabase.rpc("list_post_contributors", { p_post_ids: ids });
  if (error || !data) return {};

  const map: ContributorMap = {};
  for (const row of data as Contributor[]) {
    (map[row.content_post_id] ??= []).push(row);
  }
  return map;
}

/** The lead's name, or null when the post has no owner (44 of the imported rows). */
export function leadName(list: Contributor[] | undefined): string | null {
  return list?.find((c) => c.role === "lead")?.name ?? null;
}

/** Everyone except the lead, in the order the function returned them. */
export function collaborators(list: Contributor[] | undefined): Contributor[] {
  return (list ?? []).filter((c) => c.role !== "lead");
}
