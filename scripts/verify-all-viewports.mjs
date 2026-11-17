import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUTPUT_DIR = path.resolve("./artifacts/verification-snapshots");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const DESKTOP_VIEWPORTS = [
  { name: "desktop_1280", width: 1280, height: 800 },
  { name: "desktop_1440", width: 1440, height: 900 },
  { name: "desktop_1886", width: 1886, height: 1000 },
];

const MOBILE_VIEWPORTS = [
  { name: "mobile_320", width: 320, height: 640 },
  { name: "mobile_360", width: 360, height: 740 },
  { name: "mobile_375", width: 375, height: 812 },
  { name: "mobile_390", width: 390, height: 844 },
  { name: "mobile_414", width: 414, height: 896 },
  { name: "mobile_430", width: 430, height: 932 },
  { name: "mobile_488", width: 488, height: 900 },
  { name: "tablet_768", width: 768, height: 1024 },
];

const verificationResults = {
  timestamp: new Date().toISOString(),
  desktop: {},
  mobile: {},
  overflowIssues: [],
};

async function run() {
  console.log("Launching Microsoft Edge for rigorous multi-viewport UX verification...");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImJpamlzdGVyYm9zY2hAZ21haWwuY29tIiwic3ViIjoiY211MnpmeXYyMDAwMGw1MDRpYTZkajkwayIsImlhdCI6MTc5NDg5MjY2NywiZXhwIjoxNzk3NDg0NjY3fQ.RkXgwDC3K-hFK_pJxoYpFLrnOW1yBsRTwLv8cKfVe6U";

  await page.setCookie({
    name: "dnd_session",
    value: TOKEN,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  console.log("Navigating to application root with active session...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await page.waitForSelector("header", { timeout: 10000 });
  console.log("Authenticated AppShell mounted successfully.");

  // Helper for screenshot & overflow check
  async function checkAndSnap(label, vp) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 600));

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientW = doc.clientWidth;
      return {
        scrollWidth: scrollW,
        clientWidth: clientW,
        hasHorizontalOverflow: scrollW > clientW + 2, // 2px tolerance for subpixel rounding
      };
    });

    if (metrics.hasHorizontalOverflow) {
      console.warn(`[OVERFLOW WARNING] ${label} at ${vp.width}px: scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth}`);
      verificationResults.overflowIssues.push({ label, viewport: vp, metrics });
    }

    const fileName = `${label}_${vp.width}.png`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    await page.screenshot({ path: filePath, fullPage: false });
    return { fileName, metrics };
  }

  // ==========================================
  // PART A: DESKTOP VERIFICATION (1280, 1440, 1886)
  // ==========================================
  console.log("\n--- STARTING DESKTOP VIEWPORT VERIFICATIONS ---");
  for (const vp of DESKTOP_VIEWPORTS) {
    console.log(`\nTesting Desktop at ${vp.width}x${vp.height}...`);
    verificationResults.desktop[vp.name] = {};

    // 1. Dashboard
    await page.evaluate(() => {
      window.__WORKSPACE_STORE__?.getState()?.setIsActive(false);
      window.__NAV_STORE__?.getState()?.navigate("dashboard");
    });
    const dDash = await checkAndSnap("desktop_dashboard", vp);
    
    // Check desktop elements: sidebar visible, no mobile bottom nav
    const desktopChecks = await page.evaluate(() => {
      const sidebar = document.querySelector("aside");
      const bottomNav = document.querySelector('nav[aria-label="Mobile navigation"]');
      const mobileDrawer = document.querySelector('aside[aria-label="Navigation drawer"]');
      return {
        sidebarVisible: !!sidebar && window.getComputedStyle(sidebar).display !== "none",
        bottomNavHidden: !bottomNav || window.getComputedStyle(bottomNav).display === "none",
        drawerHidden: !mobileDrawer,
      };
    });
    verificationResults.desktop[vp.name].dashboard = { ...dDash, desktopChecks };

    // 2. Trades Log
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("tradesLog");
    });
    const dTrades = await checkAndSnap("desktop_trades_log", vp);
    verificationResults.desktop[vp.name].tradesLog = dTrades;

    // 3. Analytics Engine
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("analytics");
    });
    const dAnalytics = await checkAndSnap("desktop_analytics", vp);
    verificationResults.desktop[vp.name].analytics = dAnalytics;

    // 4. Multi-Panel Workspace
    await page.evaluate(() => {
      window.__WORKSPACE_STORE__?.getState()?.setIsActive(true);
    });
    await new Promise((r) => setTimeout(r, 600));
    const dWorkspace = await checkAndSnap("desktop_workspace", vp);
    verificationResults.desktop[vp.name].workspace = dWorkspace;

    // Close workspace for next tests
    await page.evaluate(() => {
      window.__WORKSPACE_STORE__?.getState()?.setIsActive(false);
    });
  }

  // ==========================================
  // PART B: MOBILE VIEWPORT VERIFICATION (320, 360, 375, 390, 414, 430, 488, 768)
  // ==========================================
  console.log("\n--- STARTING MOBILE BREAKPOINT VERIFICATIONS ---");
  for (const vp of MOBILE_VIEWPORTS) {
    console.log(`\nTesting Mobile Breakpoint at ${vp.width}x${vp.height}...`);
    verificationResults.mobile[vp.name] = {};

    // 1. Dashboard
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("dashboard");
    });
    const mDash = await checkAndSnap("mobile_dashboard", vp);
    verificationResults.mobile[vp.name].dashboard = mDash;

    // 2. Trades Log
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("tradesLog");
    });
    const mTrades = await checkAndSnap("mobile_trades_log", vp);
    verificationResults.mobile[vp.name].tradesLog = mTrades;

    // 3. Calendar (Check List/Agenda view default on mobile)
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("calendar");
    });
    const mCal = await checkAndSnap("mobile_calendar", vp);
    verificationResults.mobile[vp.name].calendar = mCal;

    // 4. Analytics View
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("analytics");
    });
    const mAnalytics = await checkAndSnap("mobile_analytics", vp);
    verificationResults.mobile[vp.name].analytics = mAnalytics;

    // 5. Position & Risk Calculator
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("riskCalculator");
    });
    const mRisk = await checkAndSnap("mobile_risk_calculator", vp);
    verificationResults.mobile[vp.name].riskCalculator = mRisk;

    // 6. Trading To-Do
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("tradingTodo");
    });
    const mTodo = await checkAndSnap("mobile_trading_todo", vp);
    verificationResults.mobile[vp.name].tradingTodo = mTodo;

    // 7. Settings Index
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("settings");
    });
    const mSettings = await checkAndSnap("mobile_settings_menu", vp);
    verificationResults.mobile[vp.name].settings = mSettings;

    // 8. Settings Profile Drilldown (via Bottom Nav Profile button)
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("settings", { tab: "profile" });
    });
    const mProfile = await checkAndSnap("mobile_profile_tab", vp);
    verificationResults.mobile[vp.name].profile = mProfile;

    // 9. Accounts View & Clarity
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("accounts");
    });
    const mAccounts = await checkAndSnap("mobile_accounts", vp);
    verificationResults.mobile[vp.name].accounts = mAccounts;

    // 10. Prop Challenges View
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("propChallenges");
    });
    const mChallenges = await checkAndSnap("mobile_prop_challenges", vp);
    verificationResults.mobile[vp.name].propChallenges = mChallenges;

    // 11. New Trade Form (Step Wizard on Mobile)
    await page.evaluate(() => {
      window.__NAV_STORE__?.getState()?.navigate("tradeNew");
    });
    const mTradeNew = await checkAndSnap("mobile_trade_wizard", vp);
    verificationResults.mobile[vp.name].tradeNew = mTradeNew;
  }

  // ==========================================
  // PART C: NAVIGATION & PROFILE ISOLATION VERIFICATION
  // ==========================================
  console.log("\n--- VERIFYING NAVIGATION DRAWER & PROFILE ISOLATION ---");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  
  // Test 1: Navigation drawer open/close
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("dashboard");
  });
  await new Promise((r) => setTimeout(r, 400));
  const openMenuBtn = await page.$('header button[aria-label="Open menu"]');
  if (openMenuBtn) {
    await openMenuBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    const drawerOpenSnap = await checkAndSnap("mobile_drawer_open", { width: 390, height: 844 });
    verificationResults.drawerOpen = drawerOpenSnap;

    // Verify drawer contains all module groups and NO duplicate bottom profile link
    const drawerAudit = await page.evaluate(() => {
      const drawer = document.querySelector('aside[aria-label="Navigation drawer"]');
      if (!drawer) return { found: false };
      const text = drawer.textContent || "";
      const hasOverview = text.includes("Overview");
      const hasJournal = text.includes("Journal");
      const hasAnalyze = text.includes("Analyze");
      const hasRisk = text.includes("Risk & Accounts");
      const hasTasks = text.includes("Tasks");
      const hasManage = text.includes("Manage");
      const hasSignOut = text.includes("Sign Out");
      // Check if profile identity is a div (not a button navigation to profile)
      const profileButton = drawer.querySelector('button[onClick*="handleOpenProfile"]');
      return {
        found: true,
        hasOverview,
        hasJournal,
        hasAnalyze,
        hasRisk,
        hasTasks,
        hasManage,
        hasSignOut,
        hasDuplicateProfileNavButton: !!profileButton,
      };
    });
    verificationResults.drawerAudit = drawerAudit;

    const closeBtn = await page.$('button[aria-label="Close navigation"]');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 400));
  }

  // Test 2: Check Profile Highlighting across multiple routes
  const modulesToTest = ["dashboard", "tradesLog", "calendar", "analytics", "setups", "accounts", "propChallenges", "riskCalculator", "tradingTodo"];
  const highlightingResults = {};
  for (const mod of modulesToTest) {
    await page.evaluate((m) => {
      window.__NAV_STORE__?.getState()?.navigate(m);
    }, mod);
    await new Promise((r) => setTimeout(r, 300));
    const isProfileHighlighted = await page.evaluate(() => {
      const profileBtn = document.querySelector('button[aria-label="Account Profile"]');
      if (!profileBtn) return false;
      return profileBtn.getAttribute("aria-current") === "page";
    });
    highlightingResults[mod] = { isProfileHighlighted };
  }
  
  // Test when explicitly on Profile
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("settings", { tab: "profile" });
  });
  await new Promise((r) => setTimeout(r, 300));
  const isProfileActiveWhenOnProfile = await page.evaluate(() => {
    const profileBtn = document.querySelector('button[aria-label="Account Profile"]');
    if (!profileBtn) return false;
    return profileBtn.getAttribute("aria-current") === "page";
  });
  highlightingResults["settings?tab=profile"] = { isProfileHighlighted: isProfileActiveWhenOnProfile };
  verificationResults.highlightingResults = highlightingResults;

  await browser.close();

  // Write JSON report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "verification-summary.json"),
    JSON.stringify(verificationResults, null, 2),
    "utf-8"
  );
  console.log("\n=== VERIFICATION RUN COMPLETE ===");
  console.log(`Total Overflow Issues Found: ${verificationResults.overflowIssues.length}`);
  console.log(`Results saved to: ${path.join(OUTPUT_DIR, "verification-summary.json")}`);
}

run().catch((err) => {
  console.error("Verification run failed:", err);
  process.exit(1);
});
