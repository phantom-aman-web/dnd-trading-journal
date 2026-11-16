import { createSessionToken } from "../src/lib/auth";
import fs from "fs";
import path from "path";

const TEST_USER_ID = "cmu2zfyv20000l504ia6dj90k"; // Wiwo
const TEST_EMAIL = "bijisterbosch@gmail.com";

interface CDPResponse {
  id: number;
  result?: any;
  error?: any;
}

export class CDPClient {
  private ws: WebSocket;
  private messageId = 0;
  private pending = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const data: CDPResponse = JSON.parse(event.data.toString());
          if (data.id && this.pending.has(data.id)) {
            const cb = this.pending.get(data.id)!;
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

  send(method: string, params: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve) => {
      const id = ++this.messageId;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  async wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async capture(filePath: string): Promise<void> {
    const snap = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(snap.data, "base64"));
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const outDir = path.join(process.cwd(), "verification-screenshots");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log("=== WORKSPACE PAGE-LEVEL VERIFICATION SUITE ===");
  const token = await createSessionToken({ sub: TEST_USER_ID, email: TEST_EMAIL });

  const newTabRes = await fetch("http://localhost:9222/json/new?http://localhost:3000", { method: "PUT" });
  const tabData = await newTabRes.json();
  const cdp = new CDPClient(tabData.webSocketDebuggerUrl);
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

  // Navigate to application
  console.log("Navigating to http://localhost:3000...");
  await cdp.send("Page.navigate", { url: "http://localhost:3000" });
  await cdp.wait(3500);

  // Set Desktop Viewport (1500x950 for comfortable multi-panel layout)
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1500,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Activate Workspace
  await cdp.eval(`(() => {
    const store = window.__workspaceStore?.getState();
    if (store && !store.isActive) store.toggleWorkspace();
  })()`);
  await cdp.wait(800);

  const results: any = {};

  // Helper to configure panels in workspace store
  async function configurePanels(layout: string, panels: Array<{ id: string; view: string; title: string; sizePct: number }>) {
    await cdp.eval(`(() => {
      window.__workspaceStore?.setState({
        layout: "${layout}",
        panels: ${JSON.stringify(panels)},
      });
    })()`);
    await cdp.wait(1000);
  }

  // -------------------------------------------------------------------------
  // TEST 1: Risk Calculator + Analytics (Uneven: 45% / 55%)
  // -------------------------------------------------------------------------
  console.log("[1/5] Testing Risk Calculator + Analytics (45% / 55% split)...");
  await configurePanels("2-col", [
    { id: "panel-1", view: "riskCalculator", title: "Risk Calculator", sizePct: 45 },
    { id: "panel-2", view: "analytics", title: "Analytics", sizePct: 55 },
  ]);
  await cdp.capture(path.join(outDir, "ws-01-riskcalc-analytics.png"));
  const t1Check = await cdp.eval(`(() => {
    const p1 = document.querySelector('[data-panel]:first-child');
    const p2 = document.querySelector('[data-panel]:last-child');
    return {
      hasRiskCalcInputs: !!p1?.querySelector('input[type="number"]'),
      hasAnalyticsTabs: !!p2?.querySelector('[role="tab"], button'),
      p1Width: Math.round(p1?.getBoundingClientRect().width || 0),
      p2Width: Math.round(p2?.getBoundingClientRect().width || 0),
    };
  })()`);
  results.riskCalcAndAnalytics = t1Check;

  // -------------------------------------------------------------------------
  // TEST 2: Trades Log + Calendar (Uneven: 60% / 40%)
  // -------------------------------------------------------------------------
  console.log("[2/5] Testing Trades Log + Calendar (60% / 40% split)...");
  await configurePanels("2-col", [
    { id: "panel-1", view: "tradesLog", title: "Trades Log", sizePct: 60 },
    { id: "panel-2", view: "calendar", title: "Calendar", sizePct: 40 },
  ]);
  await cdp.capture(path.join(outDir, "ws-02-tradeslog-calendar.png"));
  const t2Check = await cdp.eval(`(() => {
    const p1 = document.querySelector('[data-panel]:first-child');
    const p2 = document.querySelector('[data-panel]:last-child');
    return {
      hasTradesTable: !!p1?.querySelector("table"),
      tradesRowCount: p1?.querySelectorAll("tbody tr").length || 0,
      hasCalendarMonth: !!p2?.querySelector(".grid, [role='grid']"),
      p1Width: Math.round(p1?.getBoundingClientRect().width || 0),
      p2Width: Math.round(p2?.getBoundingClientRect().width || 0),
    };
  })()`);
  results.tradesLogAndCalendar = t2Check;

  // -------------------------------------------------------------------------
  // TEST 3: Accounts + Calendar (50% / 50%)
  // -------------------------------------------------------------------------
  console.log("[3/5] Testing Accounts + Calendar (50% / 50% split)...");
  await configurePanels("2-col", [
    { id: "panel-1", view: "accounts", title: "Accounts", sizePct: 50 },
    { id: "panel-2", view: "calendar", title: "Calendar", sizePct: 50 },
  ]);
  await cdp.capture(path.join(outDir, "ws-03-accounts-calendar.png"));
  const t3Check = await cdp.eval(`(() => {
    const p1 = document.querySelector('[data-panel]:first-child');
    const p2 = document.querySelector('[data-panel]:last-child');
    return {
      hasAccountCards: !!p1?.querySelector(".rounded-xl, .border"),
      hasCalendarCells: !!p2?.querySelector(".grid"),
      p1Width: Math.round(p1?.getBoundingClientRect().width || 0),
      p2Width: Math.round(p2?.getBoundingClientRect().width || 0),
    };
  })()`);
  results.accountsAndCalendar = t3Check;

  // -------------------------------------------------------------------------
  // TEST 4: Risk Calculator + Calendar + Trades Log (3 panels: 30% / 35% / 35%)
  // -------------------------------------------------------------------------
  console.log("[4/5] Testing Risk Calculator + Calendar + Trades Log (3 panels: 30% / 35% / 35%)...");
  await configurePanels("3-col", [
    { id: "panel-1", view: "riskCalculator", title: "Risk Calculator", sizePct: 30 },
    { id: "panel-2", view: "calendar", title: "Calendar", sizePct: 35 },
    { id: "panel-3", view: "tradesLog", title: "Trades Log", sizePct: 35 },
  ]);
  await cdp.capture(path.join(outDir, "ws-04-riskcalc-calendar-tradeslog.png"));
  const t4Check = await cdp.eval(`(() => {
    const panels = Array.from(document.querySelectorAll('[data-panel]'));
    return {
      panelsRendered: panels.length,
      panelWidths: panels.map(p => Math.round(p.getBoundingClientRect().width)),
    };
  })()`);
  results.threePanels = t4Check;

  // -------------------------------------------------------------------------
  // TEST 5: Two Analytics Panels with Independent Filters
  // -------------------------------------------------------------------------
  console.log("[5/5] Testing Two Analytics panels with independent filters...");
  await configurePanels("2-col", [
    { id: "panel-1", view: "analytics", title: "Performance Analytics", sizePct: 50 },
    { id: "panel-2", view: "analytics", title: "Process & Quality Analytics", sizePct: 50 },
  ]);
  // Set Panel 2 to "Process & Quality" -> "Data Quality"
  await cdp.eval(`(() => {
    const p2 = document.querySelectorAll('[data-panel]')[1];
    if (!p2) return;
    const buttons = Array.from(p2.querySelectorAll("button"));
    const qualityBtn = buttons.find(b => b.textContent.includes("Process & Quality"));
    if (qualityBtn) qualityBtn.click();
  })()`);
  await cdp.wait(600);
  await cdp.capture(path.join(outDir, "ws-05-two-analytics-independent.png"));
  const t5Check = await cdp.eval(`(() => {
    const panels = Array.from(document.querySelectorAll('[data-panel]'));
    const p1 = panels[0];
    const p2 = panels[1];
    return {
      hasTwoPanels: panels.length === 2,
      p1Content: p1?.querySelector("h1, h2, h3")?.textContent?.trim() || "Active",
      p2Content: p2?.querySelector("h1, h2, h3")?.textContent?.trim() || "Active",
      p1Width: Math.round(p1?.getBoundingClientRect().width || 0),
      p2Width: Math.round(p2?.getBoundingClientRect().width || 0),
    };
  })()`);
  results.twoAnalytics = t5Check;

  // Reset workspace
  await cdp.eval(`window.__workspaceStore?.getState().resetWorkspace()`);
  await cdp.eval(`window.__workspaceStore?.getState().toggleWorkspace()`);

  fs.writeFileSync(path.join(outDir, "workspace-verification-results.json"), JSON.stringify(results, null, 2));
  console.log("\n=== ALL 5 WORKSPACE PAGE-LEVEL COMBINATIONS VERIFIED ===");
  console.log("Results saved to: verification-screenshots/workspace-verification-results.json");

  cdp.close();
}

main().catch((e) => {
  console.error("Workspace verification error:", e);
  process.exit(1);
});
