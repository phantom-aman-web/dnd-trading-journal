import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUTPUT_DIR = path.resolve("./artifacts/prop-lifecycle-verification");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImJpamlzdGVyYm9zY2hAZ21haWwuY29tIiwic3ViIjoiY211MnpmeXYyMDAwMGw1MDRpYTZkajkwayIsImlhdCI6MTc5NDg5MjY2NywiZXhwIjoxNzk3NDg0NjY3fQ.RkXgwDC3K-hFK_pJxoYpFLrnOW1yBsRTwLv8cKfVe6U";

async function run() {
  console.log("=== STARTING COMPLETE PROP FIRM LIFECYCLE & FAILURE DIAGNOSIS BROWSER VERIFICATION ===");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => {
    console.error("PAGE ERROR:", err.message);
    errors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("BROWSER CONSOLE ERROR:", msg.text());
      errors.push(msg.text());
    }
  });

  await page.setCookie({
    name: "dnd_session",
    value: TOKEN,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  // 1. Desktop Viewport (1440x900)
  console.log("\n--- Step 1: Loading Prop Challenges Tracker & Aggregated Intelligence Hub ---");
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await page.waitForSelector("header", { timeout: 10000 });

  // Navigate to Prop Challenges
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("propChallenges");
  });
  await page.waitForFunction(
    () => document.body.textContent.includes("Prop Firm Portfolio & Comparison Analytics"),
    { timeout: 10000 }
  );
  await new Promise((r) => setTimeout(r, 600));

  // Screenshot Tracker Overview
  await page.screenshot({ path: path.join(OUTPUT_DIR, "01_tracker_overview.png") });

  // Verify Aggregated Analytics Hub
  const hubData = await page.evaluate(() => {
    const text = document.body.textContent || "";
    const hasHub = text.includes("Prop Firm Portfolio & Comparison Analytics");
    const hasCards = Array.from(document.querySelectorAll("button")).some(b => b.textContent?.includes("Inspect Details"));
    const cards = Array.from(document.querySelectorAll("h3")).map((h) => h.textContent?.trim());
    return {
      hasHub,
      hasCards,
      challengeTitles: cards,
    };
  });
  console.log("Tracker State:", hubData);
  if (!hubData.hasHub) {
    throw new Error("Aggregated Portfolio Analytics Hub was not rendered!");
  }

  // 2. Click on the first challenge card to open Individual Account Detail Page
  console.log("\n--- Step 2: Opening Challenge Detail Page ---");
  const detailOpened = await page.evaluate(() => {
    const inspectBtns = Array.from(document.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("Inspect Details")
    );
    if (inspectBtns.length > 0) {
      inspectBtns[0].click();
      return true;
    }
    return false;
  });

  if (!detailOpened) {
    throw new Error("Could not find 'Inspect Details' button to open detail view!");
  }
  await page.waitForSelector('[role="tab"]', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));

  // Screenshot Detail Overview
  await page.screenshot({ path: path.join(OUTPUT_DIR, "02_challenge_detail_overview.png") });

  // Check 8 tabs present
  const tabsCheck = await page.evaluate(() => {
    const tabTriggers = Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    const hasAll8 =
      tabTriggers.includes("Overview") &&
      tabTriggers.includes("Rules & Compliance") &&
      tabTriggers.includes("Performance") &&
      tabTriggers.includes("Trade History") &&
      tabTriggers.includes("Phase History") &&
      tabTriggers.includes("Failures & Breaches") &&
      tabTriggers.includes("Payouts") &&
      tabTriggers.includes("Account Settings");
    return {
      tabTriggers,
      hasAll8,
    };
  });
  console.log("Detail Tabs Verification:", tabsCheck);
  if (!tabsCheck.hasAll8) {
    throw new Error(`Expected all 8 tabs, found: ${JSON.stringify(tabsCheck.tabTriggers)}`);
  }

  // 3. Rules & Compliance Tab
  console.log("\n--- Step 3: Inspecting Rules & Compliance Tab ---");
  const tabHandles = await page.$$('[role="tab"]');
  await tabHandles[1].click();
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "03_rules_compliance_tab.png") });

  const rulesCheck = await page.evaluate(() => {
    const bodyText = document.body.textContent || "";
    return {
      hasProfitTargetRule: bodyText.includes("Profit Target"),
      hasDailyLossRule: bodyText.includes("Daily Loss Limit"),
      hasDrawdownRule: bodyText.includes("Drawdown"),
      hasConsistencyRule: bodyText.includes("Consistency"),
      hasCopyTradingRule: bodyText.includes("Copy Trading"),
      hasUnverifiedStatus: bodyText.includes("Unverified"),
    };
  });
  console.log("Rules & Compliance Check:", rulesCheck);
  if (!rulesCheck.hasDailyLossRule || !rulesCheck.hasDrawdownRule) {
    throw new Error("Rules tab did not render core rules!");
  }

  // 4. Failures & Breaches Tab
  console.log("\n--- Step 4: Inspecting Failures & Breaches Tab ---");
  await tabHandles[5].click();
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "04_failures_breaches_tab.png") });

  const breachesCheck = await page.evaluate(() => {
    const bodyText = document.body.textContent || "";
    const hasDiagnosisHeading = bodyText.includes("Violation Investigation") || bodyText.includes("Failure Diagnosis");
    const hasRecordRejectionBtn = Array.from(document.querySelectorAll("button")).some((b) =>
      b.textContent?.includes("Record Firm Rejection")
    );
    return {
      hasDiagnosisHeading,
      hasRecordRejectionBtn,
    };
  });
  console.log("Failures & Breaches Check:", breachesCheck);
  if (!breachesCheck.hasDiagnosisHeading || !breachesCheck.hasRecordRejectionBtn) {
    throw new Error("Failures & Breaches tab missing investigation controls!");
  }

  // 5. Payouts Tab
  console.log("\n--- Step 5: Inspecting Payouts Tab ---");
  await tabHandles[6].click();
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "05_payouts_tab.png") });

  const payoutsCheck = await page.evaluate(() => {
    const bodyText = document.body.textContent || "";
    return {
      hasPayoutStatus: bodyText.includes("Payout Status"),
      hasTraderProfit: bodyText.includes("Available Trader Profit"),
      hasFirmShare: bodyText.includes("Firm Profit Share"),
    };
  });
  console.log("Payouts Tab Check:", payoutsCheck);
  if (!payoutsCheck.hasPayoutStatus) {
    throw new Error("Payouts tab did not render payout status!");
  }

  // 6. Return to All Challenges
  console.log("\n--- Step 6: Returning to All Challenges ---");
  await page.evaluate(() => {
    const backBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("All Challenges")
    );
    backBtn?.click();
  });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("button")).some(b => b.textContent?.includes("Inspect Details")),
    { timeout: 10000 }
  );
  await new Promise((r) => setTimeout(r, 600));

  // 7. Mobile Viewport (390x844) Responsive Verification
  console.log("\n--- Step 7: Mobile Viewport (390x844) Inspection ---");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "06_mobile_tracker_overview.png") });

  // Open first challenge in mobile view
  await page.evaluate(() => {
    const inspectBtns = Array.from(document.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("Inspect Details")
    );
    if (inspectBtns.length > 0) inspectBtns[0].click();
  });
  await page.waitForSelector('[role="tab"]', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "07_mobile_challenge_detail.png") });

  await browser.close();

  // Assert no unhandled type errors
  const criticalErrors = errors.filter(
    (e) => e.includes("TypeError") || e.includes("accounts.map") || e.includes("is not a function")
  );
  if (criticalErrors.length > 0) {
    throw new Error(`CRITICAL RUNTIME ERROR DETECTED: ${criticalErrors.join("; ")}`);
  }

  console.log("\n=== ALL BROWSER & LIFECYCLE CHECKS PASSED 100% PERFECTLY! ===");
}

run().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
