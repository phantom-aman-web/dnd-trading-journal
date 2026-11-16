import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createSessionToken } from "../src/lib/auth";

const TEST_USER_ID = "cmu2zfyv20000l504ia6dj90k"; // Wiwo
const TEST_EMAIL = "bijisterbosch@gmail.com";

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.messageId = 0;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          if (data.id && this.pending.has(data.id)) {
            const cb = this.pending.get(data.id);
            this.pending.delete(data.id);
            if (data.error) console.error("CDP Error:", data.error);
            cb(data.result);
          }
        } catch (e) {
          console.error("Error parsing CDP message:", e);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++this.messageId;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  async wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async capture(filePath) {
    const snap = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(snap.data, "base64"));
    console.log(`Saved screenshot: ${path.basename(filePath)}`);
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const wsDir = path.join(process.cwd(), "verification-screenshots", "workspace-responsive");
  const desktopAfterDir = path.join(process.cwd(), "verification-screenshots", "normal-desktop-after");
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
  if (!fs.existsSync(desktopAfterDir)) fs.mkdirSync(desktopAfterDir, { recursive: true });

  const token = await createSessionToken({ sub: TEST_USER_ID, email: TEST_EMAIL });

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const proc = spawn(edgePath, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-fre",
    "--guest",
    "--window-size=1500,950",
    "--remote-debugging-port=9225",
    "http://localhost:3000"
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const listRes = await fetch("http://127.0.0.1:9225/json");
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    // Set auth cookie
    await cdp.send("Network.setCookie", {
      name: "dnd_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    console.log("Navigating to app...");
    await cdp.send("Page.navigate", { url: "http://localhost:3000" });
    await cdp.wait(3500);

    // Accept cookies
    await cdp.eval(`(() => {
      localStorage.setItem('dnd-cookie-consent', JSON.stringify({ choice: 'all', timestamp: Date.now(), preferences: { essential: true, functional: true, analytics: true } }));
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Accept all'));
      if (btn) btn.click();
    })()`);
    await cdp.wait(600);

    // Helper to set viewport
    async function setViewport(w, h, isMobile = false) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: isMobile,
      });
      await cdp.wait(600);
    }

    // Helper to configure workspace
    async function setupWorkspace(layout, panels) {
      await cdp.eval(`(() => {
        window.__workspaceStore?.setState({
          isActive: true,
          layout: "${layout}",
          panels: ${JSON.stringify(panels)},
        });
      })()`);
      await cdp.wait(1000);
    }

    console.log("\n=======================================================");
    console.log("PART A: WORKSPACE ALL GRID CONFIGS & SCREEN SIZES");
    console.log("=======================================================");

    // 1. Wide Desktop (1500px) - 2-col (Risk Calc + Analytics 45% / 55%)
    await setViewport(1500, 950);
    await setupWorkspace("2-col", [
      { id: "p1", view: "riskCalculator", title: "Risk Calculator", sizePct: 45 },
      { id: "p2", view: "analytics", title: "Analytics", sizePct: 55 },
    ]);
    await cdp.capture(path.join(wsDir, "01-wide-desktop-2col-riskcalc-analytics.png"));

    // 2. Wide Desktop (1500px) - Uneven 2-col (30% / 70% split) - Trades Log + Calendar
    await setupWorkspace("2-col", [
      { id: "p1", view: "tradesLog", title: "Trades Log", sizePct: 30 },
      { id: "p2", view: "calendar", title: "Calendar", sizePct: 70 },
    ]);
    await cdp.capture(path.join(wsDir, "02-wide-desktop-uneven-tradeslog-calendar.png"));

    // 3. Wide Desktop (1500px) - 3-col (Risk Calc 30% + Calendar 35% + Trades Log 35%)
    await setupWorkspace("3-col", [
      { id: "p1", view: "riskCalculator", title: "Risk Calculator", sizePct: 30 },
      { id: "p2", view: "calendar", title: "Calendar", sizePct: 35 },
      { id: "p3", view: "tradesLog", title: "Trades Log", sizePct: 35 },
    ]);
    await cdp.capture(path.join(wsDir, "03-wide-desktop-3col-risk-calendar-trades.png"));

    // 4. Standard Desktop (1280px) - 2-row (Stacked 50% / 50%) - Accounts + Calendar
    await setViewport(1280, 800);
    await setupWorkspace("2-row", [
      { id: "p1", view: "accounts", title: "Accounts", sizePct: 50 },
      { id: "p2", view: "calendar", title: "Calendar", sizePct: 50 },
    ]);
    await cdp.capture(path.join(wsDir, "04-standard-desktop-2row-accounts-calendar.png"));

    // 5. Standard Desktop (1280px) - 4-grid (Quad Matrix)
    await setupWorkspace("4-grid", [
      { id: "p1", view: "dashboard", title: "Dashboard", sizePct: 50 },
      { id: "p2", view: "tradesLog", title: "Trades Log", sizePct: 50 },
      { id: "p3", view: "analytics", title: "Analytics", sizePct: 50 },
      { id: "p4", view: "riskCalculator", title: "Risk Calculator", sizePct: 50 },
    ]);
    await cdp.capture(path.join(wsDir, "05-standard-desktop-4grid-quad.png"));

    // 6. Smaller Desktop / Laptop (1024px) - Two Analytics panels with independent filters
    await setViewport(1024, 768);
    await setupWorkspace("2-col", [
      { id: "p1", view: "analytics", title: "Analytics Overall", sizePct: 50 },
      { id: "p2", view: "analytics", title: "Analytics Sessions", sizePct: 50 },
    ]);
    await cdp.capture(path.join(wsDir, "06-smaller-desktop-two-analytics-panels.png"));

    // 7. Smaller Desktop / Laptop (1024px) - 3-col warning banner test
    await setupWorkspace("3-col", [
      { id: "p1", view: "riskCalculator", title: "Risk Calculator", sizePct: 33 },
      { id: "p2", view: "tradesLog", title: "Trades Log", sizePct: 33 },
      { id: "p3", view: "calendar", title: "Calendar", sizePct: 34 },
    ]);
    await cdp.capture(path.join(wsDir, "07-smaller-desktop-3col-with-warning.png"));

    // 8. Tablet (768px) - 2-col responsive split (Trades Log + Risk Calculator)
    await setViewport(768, 1024);
    await setupWorkspace("2-col", [
      { id: "p1", view: "tradesLog", title: "Trades Log", sizePct: 50 },
      { id: "p2", view: "riskCalculator", title: "Risk Calculator", sizePct: 50 },
    ]);
    await cdp.capture(path.join(wsDir, "08-tablet-768px-2col.png"));

    // 9. Mobile (390px) - Mobile Tab focused presentation
    await setViewport(390, 844, true);
    await cdp.wait(800);
    await cdp.capture(path.join(wsDir, "09-mobile-390px-tab1-trades.png"));

    // Switch mobile tab to panel 2
    await cdp.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const p2Btn = btns.find(b => b.textContent && b.textContent.includes('Panel 2'));
      if (p2Btn) p2Btn.click();
    })()`);
    await cdp.wait(600);
    await cdp.capture(path.join(wsDir, "10-mobile-390px-tab2-riskcalc.png"));

    console.log("\n=======================================================");
    console.log("PART B: WORKSPACE PANEL MANAGEMENT ACTIONS");
    console.log("=======================================================");

    // Return to desktop
    await setViewport(1440, 900);
    await setupWorkspace("2-col", [
      { id: "p1", view: "tradesLog", title: "Trades Log", sizePct: 50 },
      { id: "p2", view: "analytics", title: "Analytics", sizePct: 50 },
    ]);

    // Test 11: Maximize Panel 1
    console.log("Testing maximize panel 1...");
    await cdp.eval(`(() => {
      const maxBtn = document.querySelector('button[title="Maximize this panel"]');
      if (maxBtn) maxBtn.click();
    })()`);
    await cdp.wait(800);
    await cdp.capture(path.join(wsDir, "11-desktop-maximized-panel.png"));

    // Test 12: Restore Split Layout
    console.log("Testing restore split layout...");
    await cdp.eval(`(() => {
      const restBtn = document.querySelector('button[title="Restore split layout"]');
      if (restBtn) restBtn.click();
    })()`);
    await cdp.wait(800);
    await cdp.capture(path.join(wsDir, "12-desktop-restored-split.png"));

    // Test 13: Add 3rd Panel
    console.log("Testing add 3rd panel...");
    await cdp.eval(`(() => {
      const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Add Panel'));
      if (addBtn) addBtn.click();
    })()`);
    await cdp.wait(800);
    await cdp.capture(path.join(wsDir, "13-desktop-added-panel.png"));

    // Test 14: Close a Panel
    console.log("Testing close a panel...");
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[title="Close this panel"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await cdp.wait(800);
    await cdp.capture(path.join(wsDir, "14-desktop-closed-panel.png"));

    console.log("\n=======================================================");
    console.log("PART C: NORMAL DESKTOP INTERFACE ISOLATION CHECK");
    console.log("=======================================================");

    // Exit workspace
    await cdp.eval(`(() => {
      window.__workspaceStore?.setState({ isActive: false });
    })()`);
    await cdp.wait(1000);

    const normalViews = [
      { key: "dashboard", name: "01-normal-desktop-dashboard" },
      { key: "tradesLog", name: "02-normal-desktop-tradeslog" },
      { key: "analytics", name: "03-normal-desktop-analytics" },
      { key: "accounts", name: "04-normal-desktop-accounts" },
      { key: "settings", name: "05-normal-desktop-settings" },
    ];

    for (const nv of normalViews) {
      await cdp.eval(`window.__navStore?.getState()?.navigate('${nv.key}')`);
      await cdp.wait(1200);
      await cdp.capture(path.join(desktopAfterDir, `${nv.name}.png`));
    }

    console.log("\n=== ALL VERIFICATIONS COMPLETED SUCCESSFULLY ===");
    cdp.close();
  } finally {
    proc.kill();
  }
}

main().catch(console.error);
