import { createClient } from "@supabase/supabase-js";
import { readBackendConfig } from "./config";
import { DemoRepository } from "./demo";
import { SupabaseRepository } from "./supabase";
import type { WorkspaceRepository } from "./contracts";

export const backendConfig = readBackendConfig(import.meta.env);
export const repository: WorkspaceRepository | null = backendConfig.mode === "error" ? null
  : backendConfig.mode === "demo" ? new DemoRepository()
    : new SupabaseRepository(createClient(backendConfig.url, backendConfig.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }), { url: backendConfig.url, key: backendConfig.key });

export const accountRepository = repository instanceof SupabaseRepository ? repository : null;
