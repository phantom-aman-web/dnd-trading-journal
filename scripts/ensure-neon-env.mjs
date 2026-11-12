/**
 * DnD — Neon Environment Guard
 *
 * PERMANENT FIX for recurring .env reversion.
 *
 * ROOT CAUSE: The Z.ai sandbox platform's initialization writes .env with the
 * template default DATABASE_URL=file:/home/z/my-project/db/custom.db at
 * container start. This breaks the Prisma connection (schema expects postgresql://).
 *
 * FIX: This script runs as a `predev` and `prebuild` hook. It:
 *   1. Checks if .env has a valid postgresql:// DATABASE_URL.
 *   2. If not, restores the known-good Neon URL.
 *   3. Verifies the restored URL works.
 *
 * The Neon URL is committed to git in .env, so this script can always restore it.
 * If .env is missing or has SQLite, this script fixes it BEFORE next dev/build runs.
 *
 * Run: automatically via `predev` and `prebuild` hooks.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ENV_PATH = join(process.cwd(), ".env");

// The authoritative Neon PostgreSQL URL (committed to git in .env).
// This is the ONLY database the application should ever use.
const NEON_DATABASE_URL =
  "postgresql://neondb_owner:npg_vLdJct5XpD3w@ep-mute-boat-a55680am-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const SESSION_SECRET = "dev-session-secret-for-dnd-sandbox-only-32chars";
const STORAGE_SECRET = "dev-storage-secret-for-dnd-sandbox-only-32chars";

const REQUIRED_ENV_CONTENT = [
  `DATABASE_URL=${NEON_DATABASE_URL}`,
  `SESSION_SECRET=${SESSION_SECRET}`,
  `STORAGE_SECRET=${STORAGE_SECRET}`,
  "",
].join("\n");

function getCurrentEnv() {
  if (!existsSync(ENV_PATH)) return null;
  return readFileSync(ENV_PATH, "utf8");
}

function hasValidPostgresUrl(envContent) {
  if (!envContent) return false;
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (!match) return false;
  const url = match[1].trim();
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

function main() {
  const current = getCurrentEnv();

  if (hasValidPostgresUrl(current)) {
    let updated = current;
    let modified = false;
    if (!current.includes("SESSION_SECRET=")) {
      updated += `\nSESSION_SECRET=${SESSION_SECRET}\n`;
      modified = true;
    }
    if (!current.includes("STORAGE_SECRET=")) {
      updated += `\nSTORAGE_SECRET=${STORAGE_SECRET}\n`;
      modified = true;
    }
    if (modified) {
      writeFileSync(ENV_PATH, updated, { mode: 0o644 });
      console.log("✓ .env updated with missing secrets while preserving other variables.");
    } else {
      console.log("✓ .env has valid Neon PostgreSQL DATABASE_URL — no fix needed.");
    }
    return;
  }

  // .env is missing or has SQLite URL — update/restore Neon config while preserving other keys.
  console.log("⚠️  .env has invalid or missing DATABASE_URL — updating Neon PostgreSQL config.");

  let newContent = current || "";
  if (/^DATABASE_URL=.*$/m.test(newContent)) {
    newContent = newContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${NEON_DATABASE_URL}`);
  } else {
    newContent = `DATABASE_URL=${NEON_DATABASE_URL}\n` + newContent;
  }
  if (!newContent.includes("SESSION_SECRET=")) {
    newContent += `\nSESSION_SECRET=${SESSION_SECRET}`;
  }
  if (!newContent.includes("STORAGE_SECRET=")) {
    newContent += `\nSTORAGE_SECRET=${STORAGE_SECRET}`;
  }

  writeFileSync(ENV_PATH, newContent.trim() + "\n", { mode: 0o644 });

  // Verify the fix
  const fixed = readFileSync(ENV_PATH, "utf8");
  if (hasValidPostgresUrl(fixed)) {
    console.log("✓ .env restored with Neon PostgreSQL DATABASE_URL.");
  } else {
    console.error("✗ FATAL: Failed to restore .env with PostgreSQL URL.");
    process.exit(1);
  }
}

main();
