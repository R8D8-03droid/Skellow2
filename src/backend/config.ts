export type BackendConfig =
  | { mode: "demo" }
  | { mode: "supabase"; url: string; key: string }
  | { mode: "error"; message: string };

export function readBackendConfig(env: Record<string, string | undefined>): BackendConfig {
  const mode = env.VITE_DATA_MODE;
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const invalid = (message: string): BackendConfig => ({ mode: "error", message });
  if (mode && !["demo", "supabase"].includes(mode)) return invalid("VITE_DATA_MODE doit valoir demo ou supabase.");
  if (mode === "demo") return { mode: "demo" };
  if (!url && !key && !mode) return { mode: "demo" };
  if (!url || !key) return invalid("La connexion est incomplète. Renseignez l’URL Supabase et sa clé publique dans .env.local.");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) throw new Error();
  } catch { return invalid("L’URL Supabase doit être une URL HTTPS valide (HTTP autorisé en local)."); }
  let isAnon = false;
  try { isAnon = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"; } catch { /* publishable keys are not JWTs */ }
  if (!key.startsWith("sb_publishable_") && !isAnon) return invalid("Utilisez uniquement une clé publishable ou anon. Une clé secrète ne doit jamais être utilisée dans le navigateur.");
  return { mode: "supabase", url, key };
}
