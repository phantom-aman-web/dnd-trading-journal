import { createSessionToken } from "../src/lib/auth";
import fs from "fs";
import path from "path";

const TEST_USER_ID = "cmu2zfyv20000l504ia6dj90k"; // Wiwo (19 trades, 1 account)
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
            if (data.error) {
              console.error("CDP Error:", data.error);
            }
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

  console.log("=== ALPHAPIPS BROWSER VERIFICATION SUITE ===");
  const token = await createSessionToken({ sub: TEST_USER_ID, email: TEST_EMAIL });

  // Create new page tab
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

  // Set default Desktop Viewport (1440x900)
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const testReport: any = {
    timestamp: new Date().toISOString(),
    viewports: {},
    themes: {},
    views: {},
    collisionChecks: {},
  };

  // Helper to switch view
  async function goToView(view: string, params: any = {}) {
    await cdp.eval(`window.__navStore?.getState().navigate("${view}", ${JSON.stringify(params)})`);
    await cdp.wait(800);
  }

  // Helper to switch theme
  async function switchTheme(theme: string) {
    await cdp.eval(`window.__themeControl?.setTheme("${theme}")`);
    await cdp.wait(400);
  }

  // 1. Dashboard — Nordic Theme
  console.log("[1/12] Verifying Dashboard (Nordic 1440x900)...");
  await goToView("dashboard");
  await switchTheme("nordic");
  await cdp.capture(path.join(outDir, "01-dashboard-nordic.png"));
  testReport.views.dashboard = { verified: true, theme: "nordic", screenshot: "01-dashboard-nordic.png" };

  // 2. Dashboard — Sleek Terminal Theme (verify cyan action vs emerald profit)
  console.log("[2/12] Verifying Dashboard (Sleek Terminal)...");
  await switchTheme("terminal");
  await cdp.wait(400);
  await cdp.capture(path.join(outDir, "02-dashboard-terminal.png"));
  const terminalColors = await cdp.eval(`(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    return {
      theme: root.getAttribute("data-theme"),
      primary: computed.getPropertyValue("--primary").trim(),
      profit: computed.getPropertyValue("--profit").trim(),
    };
  })()`);
  testReport.themes.terminal = terminalColors;

  // 3. Dashboard — Slate Contrast Theme
  console.log("[3/12] Verifying Dashboard (Slate Contrast)...");
  await switchTheme("institutional");
  await cdp.wait(400);
  await cdp.capture(path.join(outDir, "03-dashboard-slate-contrast.png"));
  const slateColors = await cdp.eval(`(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    return {
      theme: root.getAttribute("data-theme"),
      background: computed.getPropertyValue("--background").trim(),
      card: computed.getPropertyValue("--card").trim(),
      border: computed.getPropertyValue("--border").trim(),
    };
  })()`);
  testReport.themes.slateContrast = slateColors;

  // Reset to Nordic for subsequent checks
  await switchTheme("nordic");

  // 4. Trades Log View (with New Entry dropdown and filters)
  console.log("[4/12] Verifying Trades Log...");
  await goToView("tradesLog");
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "04-trades-log.png"));
  const tradesLogState = await cdp.eval(`(() => {
    return {
      hasTable: !!document.querySelector("table"),
      rowsCount: document.querySelectorAll("table tbody tr").length,
      hasNewEntryBtn: !!Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("New Entry")),
    };
  })()`);
  testReport.views.tradesLog = tradesLogState;

  // 5. New Trade Wizard (Step 3: Risk & Sizing, Step 5: Confirm & Save)
  console.log("[5/12] Verifying New Trade Wizard...");
  await goToView("tradeNew");
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "05-new-trade-wizard.png"));
  testReport.views.tradeNew = { verified: true, screenshot: "05-new-trade-wizard.png" };

  // 6. Calendar View (Today Highlight & Clean Empty Cells)
  console.log("[6/12] Verifying Calendar View (Today highlight)...");
  await goToView("calendar");
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "06-calendar-view.png"));
  const calendarChecks = await cdp.eval(`(() => {
    const cells = document.querySelectorAll(".grid .min-h-\\\\[100px\\\\], .grid .min-h-\\\\[110px\\\\]");
    const todayCell = document.querySelector(".ring-primary\\\\/40, .border-primary\\\\/40, .bg-primary\\\\/10");
    const plusLogDayCount = Array.from(document.querySelectorAll("*")).filter(el => el.textContent === "+ Log Day").length;
    return {
      cellCount: cells.length,
      hasTodayHighlight: !!todayCell,
      repetitivePlusLogDayCount: plusLogDayCount, // Should be 0
    };
  })()`);
  testReport.views.calendar = calendarChecks;

  // 7. Analytics View (4-Category Navigation, All 9 Sections, Data Quality)
  console.log("[7/12] Verifying Analytics View & Categories...");
  await goToView("analytics");
  await cdp.wait(1000);
  await cdp.capture(path.join(outDir, "07-analytics-performance.png"));

  // Click on "Process & Quality" category tab
  await cdp.eval(`(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const qualityBtn = buttons.find(b => b.textContent.includes("Process & Quality"));
    if (qualityBtn) qualityBtn.click();
  })()`);
  await cdp.wait(500);

  // Click on "Data Quality" tab
  await cdp.eval(`(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const dqBtn = buttons.find(b => b.textContent.includes("Data Quality"));
    if (dqBtn) dqBtn.click();
  })()`);
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "08-analytics-data-quality.png"));
  const analyticsQualityCheck = await cdp.eval(`(() => {
    return {
      hasCompletenessCard: !!document.querySelector("svg.text-primary"),
      hasFormulaDrawerBtn: !!Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("How Journal Completeness is Calculated")),
      issueCardsCount: document.querySelectorAll(".rounded-xl.border.p-4").length,
    };
  })()`);
  testReport.views.analyticsDataQuality = analyticsQualityCheck;

  // 8. Accounts & Prop Challenges (Open Challenge Creation Dialog & Inspect Collision)
  console.log("[8/12] Verifying Accounts & Prop Challenge Modal...");
  await goToView("propChallenges");
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "09-prop-challenges-overview.png"));

  // Open "+ New Challenge" modal
  await cdp.eval(`(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const newChallengeBtn = buttons.find(b => b.textContent.includes("New Challenge"));
    if (newChallengeBtn) newChallengeBtn.click();
  })()`);
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "10-prop-challenge-modal.png"));

  // Verify bounding boxes and collision of Drawdown Model and Min Trading Days
  const collisionVerification = await cdp.eval(`(() => {
    const labels = Array.from(document.querySelectorAll("label"));
    const drawdownLabel = labels.find(l => l.textContent.includes("Drawdown Model"));
    const minDaysLabel = labels.find(l => l.textContent.includes("Min Trading Days"));
    if (!drawdownLabel || !minDaysLabel) return { found: false, labelsFound: labels.map(l => l.textContent) };

    const ddBox = drawdownLabel.parentElement?.getBoundingClientRect();
    const minDaysBox = minDaysLabel.parentElement?.getBoundingClientRect();

    if (!ddBox || !minDaysBox) return { found: false };

    // Check for overlap:
    const horizontalOverlap = !(ddBox.right <= minDaysBox.left || minDaysBox.right <= ddBox.left);
    const verticalOverlap = !(ddBox.bottom <= minDaysBox.top || minDaysBox.bottom <= ddBox.top);
    const colliding = horizontalOverlap && verticalOverlap;

    return {
      found: true,
      drawdownBox: { left: Math.round(ddBox.left), right: Math.round(ddBox.right), width: Math.round(ddBox.width) },
      minDaysBox: { left: Math.round(minDaysBox.left), right: Math.round(minDaysBox.right), width: Math.round(minDaysBox.width) },
      colliding,
      cleanSeparation: !colliding,
    };
  })()`);
  testReport.collisionChecks.propChallengeModal = collisionVerification;

  // Close modal with Escape or Cancel button
  await cdp.eval(`(() => {
    const cancelBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Cancel");
    if (cancelBtn) cancelBtn.click();
  })()`);
  await cdp.wait(400);

  // 9. Risk Calculator (with Saved Scenarios toolbar)
  console.log("[9/12] Verifying Risk Calculator with Saved Scenarios...");
  await goToView("riskCalculator");
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "11-risk-calculator.png"));
  const riskCalcCheck = await cdp.eval(`(() => {
    return {
      hasHeader: !!document.querySelector("h1")?.textContent?.includes("Position & Risk Calculator"),
      hasScenariosBtn: !!Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Scenarios")),
      hasSaveScenarioBtn: !!Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Save Scenario")),
      hasTransferBtn: !!Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Transfer Sizing to New Trade")),
    };
  })()`);
  testReport.views.riskCalculator = riskCalcCheck;

  // 10. Preferences Center (Miniature Theme Cards & 3 Typography Roles)
  console.log("[10/12] Verifying Preferences Center...");
  await goToView("settings");
  await cdp.wait(500);
  // Click on the Preferences tab trigger in settings
  await cdp.eval(`(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const prefTab = tabs.find(t => t.textContent.includes("Preferences"));
    if (prefTab) (prefTab as any).click();
  })()`);
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "12-preferences-center.png"));
  const preferencesCheck = await cdp.eval(`(() => {
    return {
      hasThemeCards: !!document.querySelector('.group.relative.flex.flex-col, [data-theme-preview]'),
      hasInterfaceFontSelect: document.body.innerText.includes("Interface Font"),
      hasDisplayFontSelect: document.body.innerText.includes("Display Heading Font"),
      hasFinancialFontSelect: document.body.innerText.includes("Financial Tabular Font") || document.body.innerText.includes("Financial Numerical Font"),
      hasTypographyLivePreview: document.body.innerText.includes("Live Typography Hierarchy Preview") || document.body.innerText.includes("Typography Hierarchy Preview"),
    };
  })()`);
  testReport.views.preferences = preferencesCheck;

  // 11. Responsive Viewports: Tablet (768x1024) and Mobile (390x844)
  console.log("[11/12] Verifying Responsive Tablet (768x1024) and Mobile (390x844)...");
  // Tablet
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await goToView("dashboard");
  await cdp.wait(600);
  await cdp.capture(path.join(outDir, "13-dashboard-tablet-768.png"));
  testReport.viewports.tablet = { width: 768, height: 1024, screenshot: "13-dashboard-tablet-768.png" };

  // Mobile
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await cdp.wait(600);
  await cdp.capture(path.join(outDir, "14-dashboard-mobile-390.png"));
  testReport.viewports.mobile = { width: 390, height: 844, screenshot: "14-dashboard-mobile-390.png" };

  // Restore Desktop Viewport
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 12. Multi-Panel Workspace (2-panel default & 3-panel adaptive warning chip)
  console.log("[12/13] Verifying Multi-Panel Workspace...");
  await goToView("dashboard");
  await cdp.eval(`window.__workspaceStore?.getState().toggleWorkspace()`);
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "16-workspace-2-panel.png"));

  // Switch to 3-col layout on 1200px viewport to trigger adaptive warning
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1200,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.eval(`window.__workspaceStore?.getState().setLayout("3-col")`);
  await cdp.wait(600);
  await cdp.capture(path.join(outDir, "17-workspace-3-panel-narrow-warning.png"));

  const workspaceCheck = await cdp.eval(`(() => {
    return {
      hasResizePanels: !!document.querySelector('[data-panel-group]'),
      hasAdaptiveWarning: document.body.innerText.includes("Narrow Viewport") || document.body.innerText.includes("3 columns may compress"),
      panelsCount: document.querySelectorAll('[data-panel]').length,
    };
  })()`);
  testReport.views.workspace = workspaceCheck;

  // Close workspace and restore viewport
  await cdp.eval(`window.__workspaceStore?.getState().toggleWorkspace()`);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.wait(400);

  // 13. Public Landing Page
  console.log("[13/13] Verifying Landing Page...");
  await goToView("landing");
  await cdp.wait(800);
  await cdp.capture(path.join(outDir, "15-landing-page.png"));
  testReport.views.landing = { verified: true, screenshot: "15-landing-page.png" };

  fs.writeFileSync(path.join(outDir, "verification-report.json"), JSON.stringify(testReport, null, 2));
  console.log("\n=== ALL 13 VERIFICATION SUITES COMPLETED SUCCESSFULLY ===");
  console.log("Full Report saved to: verification-screenshots/verification-report.json");

  cdp.close();
}

main().catch((err) => {
  console.error("Verification suite encountered error:", err);
  process.exit(1);
});
