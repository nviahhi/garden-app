/** true, если created_at >= seasonStart (видим в текущем сезоне).
 * Если seasonStart null — видим всё. */
export function isVisibleSince(
  created_at: string | undefined,
  seasonStart: string | null
): boolean {
  if (!seasonStart) return true;
  if (!created_at) return true;
  return new Date(created_at).getTime() >= new Date(seasonStart).getTime();
}
