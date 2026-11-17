import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUTPUT_DIR = path.resolve("./artifacts/ux-snapshots");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  console.log("Launching Edge for UX verification...");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  // Helper for taking screenshot
  async function snap(name, width, height) {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 1500));
    const filePath = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`Saved screenshot: ${name}.png (${width}x${height})`);
  }

  // 1. Mobile - Dashboard (390x844)
  console.log("Navigating to Dashboard on mobile...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await snap("01_mobile_dashboard_390", 390, 844);

  // 2. Mobile - Open Slide-over Drawer
  console.log("Opening mobile drawer...");
  const menuBtn = await page.$('header button[aria-label="Open menu"]');
  if (menuBtn) {
    await menuBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    await snap("02_mobile_drawer_open_390", 390, 844);
    // Close drawer
    const closeBtn = await page.$('button[aria-label="Close navigation menu"]');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 400));
  }

  // 3. Mobile - Trades Log
  console.log("Navigating to Trades Log...");
  const tradesNavBtn = await page.$('button[title="Trades Log"]');
  if (tradesNavBtn) {
    await tradesNavBtn.click();
  } else {
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("tradesLog");
    });
  }
  await new Promise((r) => setTimeout(r, 1200));
  await snap("03_mobile_trades_log_390", 390, 844);

  // 4. Mobile - Trades Log with Filter Sheet Open
  const filterClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const b = btns.find((el) => el.textContent && el.textContent.includes("Filters"));
    if (b) {
      b.click();
      return true;
    }
    return false;
  });
  if (filterClicked) {
    await new Promise((r) => setTimeout(r, 600));
    await snap("04_mobile_trades_filters_sheet_390", 390, 844);
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 400));
  }

  // 5. Mobile - Trading Calendar
  console.log("Navigating to Trading Calendar...");
  const calNavBtn = await page.$('button[title="Trading Calendar"]');
  if (calNavBtn) {
    await calNavBtn.click();
  } else {
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("calendar");
    });
  }
  await new Promise((r) => setTimeout(r, 1200));
  await snap("05_mobile_calendar_list_view_390", 390, 844);

  // 6. Mobile - Analytics Engine
  console.log("Navigating to Analytics...");
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("analytics");
  });
  await new Promise((r) => setTimeout(r, 1500));
  await snap("06_mobile_analytics_390", 390, 844);

  // 7. Mobile - Risk Calculator
  console.log("Navigating to Risk Calculator...");
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("riskCalculator");
  });
  await new Promise((r) => setTimeout(r, 1200));
  await snap("07_mobile_risk_calculator_390", 390, 844);

  // 8. Mobile - Trading To-Do
  console.log("Navigating to Trading To-Do...");
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("tradingTodo");
  });
  await new Promise((r) => setTimeout(r, 1200));
  await snap("08_mobile_trading_todo_390", 390, 844);

  // 9. Mobile - Settings Menu (Category Index)
  console.log("Navigating to Settings Index...");
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("settings");
  });
  await new Promise((r) => setTimeout(r, 1200));
  await snap("09_mobile_settings_menu_390", 390, 844);

  // 10. Mobile - Settings Profile Tab (via Bottom Nav Profile button)
  console.log("Clicking Bottom Nav Profile button...");
  const profileNavBtn = await page.$('button[title="Profile & Settings"]');
  if (profileNavBtn) {
    await profileNavBtn.click();
  } else {
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("settings", { tab: "profile" });
    });
  }
  await new Promise((r) => setTimeout(r, 1200));
  await snap("10_mobile_settings_profile_tab_390", 390, 844);

  // 11. Normal Desktop - Dashboard (1440x900)
  console.log("Navigating to Desktop Dashboard (1440x900)...");
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("dashboard");
  });
  await snap("11_desktop_dashboard_1440", 1440, 900);

  // 12. Normal Desktop - Trades Log (1440x900)
  console.log("Navigating to Desktop Trades Log (1440x900)...");
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("tradesLog");
  });
  await snap("12_desktop_trades_log_1440", 1440, 900);

  // 13. Normal Desktop - Analytics (1440x900)
  console.log("Navigating to Desktop Analytics (1440x900)...");
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("analytics");
  });
  await snap("13_desktop_analytics_1440", 1440, 900);

  // 14. Normal Desktop - Multi-Panel Workspace (1440x900)
  console.log("Navigating to Desktop Workspace (1440x900)...");
  await page.evaluate(() => {
    window.__WORKSPACE_STORE__?.getState()?.openWorkspace();
  });
  await snap("14_desktop_workspace_1440", 1440, 900);

  await browser.close();
  console.log("All visual snapshots captured successfully!");
}

run().catch((err) => {
  console.error("Snapshot error:", err);
  process.exit(1);
});
