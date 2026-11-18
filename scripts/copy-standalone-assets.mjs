import fs from "fs";

try {
  if (fs.existsSync(".next/standalone")) {
    if (fs.existsSync(".next/static")) {
      fs.mkdirSync(".next/standalone/.next", { recursive: true });
      fs.cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
    }
    if (fs.existsSync("public")) {
      fs.cpSync("public", ".next/standalone/public", { recursive: true });
    }
  }
} catch (e) {
  console.warn("Notice: standalone copy skipped or completed with notice:", e.message);
}
