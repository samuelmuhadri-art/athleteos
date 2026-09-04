export function firstSupabaseError(results) {
  return (results ?? []).find(result => result?.error)?.error ?? null;
}
