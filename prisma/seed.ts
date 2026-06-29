/**
 * Seed bootstrap. Loads .env (so `npm run db:seed` works without exporting
 * vars) BEFORE the Prisma client / lib modules are imported, then runs the
 * actual seed. In Docker the env is already present, so the .env load is a
 * no-op. tsx resolves the `@/*` and relative TS imports.
 */
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

await import("./seed.main.js");
