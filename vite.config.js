import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readBackendConfig } from "./src/backend/config.ts";

export default defineConfig(({ command, mode }) => {
  // Fail the release before publishing an unusable connection configuration.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const config = readBackendConfig(env);
  if (command === "build" && config.mode === "error") {
    throw new Error(config.message);
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
    },
  };
});
