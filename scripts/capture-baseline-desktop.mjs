import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createSessionToken } from "../src/lib/auth";

const TEST_USER_ID = "cmu2zfyv20000l504ia6dj90k"; // Wiwo
const TEST_EMAIL = "bijisterbosch@gmail.com";

async function main() {
  const outDir = path.join(process.cwd(), "verification-screenshots", "baseline-desktop");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const token = await createSessionToken({ sub: TEST_USER_ID, email: TEST_EMAIL });

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const proc = spawn(edgePath, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-fre",
    "--guest",
    "--window-size=1440,900",
    "--remote-debugging-port=9223",
    "http://localhost:3000"
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const listRes = await fetch("http://127.0.0.1:9223/json");
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.result);
        callbacks.delete(data.id);
      }
    };

    await new Promise((r) => (ws.onopen = r));

    function send(method, params = {}) {
      const msgId = id++;
      return new Promise((resolve) => {
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    async function evalCode(expression) {
      const res = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res?.result?.value;
    }

    async function capture(filename) {
      const snap = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(outDir, filename), Buffer.from(snap.data, "base64"));
      console.log(`Saved baseline: ${filename}`);
    }

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");

    // Set auth session
    await send("Network.setCookie", {
      name: "dnd_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    // 1. Desktop Dashboard Baseline
    await send("Page.navigate", { url: "http://localhost:3000" });
    await new Promise((r) => setTimeout(r, 2000));
    await evalCode(`window.__navStore?.getState()?.navigate("dashboard")`);
    await new Promise((r) => setTimeout(r, 1500));
    await capture("01-baseline-desktop-dashboard.png");

    // 2. Desktop Trades Log Baseline
    await evalCode(`window.__navStore?.getState()?.navigate("tradesLog")`);
    await new Promise((r) => setTimeout(r, 1500));
    await capture("02-baseline-desktop-tradeslog.png");

    // 3. Desktop Analytics Baseline
    await evalCode(`window.__navStore?.getState()?.navigate("analytics")`);
    await new Promise((r) => setTimeout(r, 1500));
    await capture("03-baseline-desktop-analytics.png");

    // 4. Desktop Accounts Baseline
    await evalCode(`window.__navStore?.getState()?.navigate("accounts")`);
    await new Promise((r) => setTimeout(r, 1500));
    await capture("04-baseline-desktop-accounts.png");

    // 5. Desktop Settings Baseline
    await evalCode(`window.__navStore?.getState()?.navigate("settings")`);
    await new Promise((r) => setTimeout(r, 1500));
    await capture("05-baseline-desktop-settings.png");

    // Also capture Landing Page BEFORE changes
    await send("Network.deleteCookies", { name: "dnd_session", domain: "localhost", path: "/" });
    await send("Page.navigate", { url: "http://localhost:3000" });
    await new Promise((r) => setTimeout(r, 2500));
    await capture("00-baseline-landing-page.png");

    ws.close();
  } catch (err) {
    console.error("Baseline capture error:", err);
  } finally {
    proc.kill();
  }
}

main();
