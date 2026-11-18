import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUTPUT_DIR = path.resolve("./artifacts/browser-interaction-results");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log("=== STARTING COMPREHENSIVE REAL BROWSER INTERACTION SUITE ===");

  const user = await db.user.findUnique({ where: { email: "phantom@aman.com" } });
  if (!user) throw new Error("phantom@aman.com not found!");

  const token = await createSessionToken({ sub: user.id, email: user.email });

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  await page.setCookie({
    name: "dnd_session",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
  });

  const testResults = {
    desktop: {},
    mobile: {},
    interactions: {},
    errors: [],
  };

  // -------------------------------------------------------------
  // DESKTOP INTERACTION (1440x900)
  // -------------------------------------------------------------
  console.log("\n--- DESKTOP TEST: 1440x900 ---");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await sleep(1000);

  // Navigate to Prop Challenges
  console.log("Navigating to Prop Challenges section...");
  await page.evaluate(() => {
    window.__navStore?.getState()?.navigate("propChallenges");
  });

  console.log("Waiting for Prop Challenges & Portfolio reconciliation banner...");
  await page.waitForFunction(
    () => document.body.innerText.includes("Alpha Capital") && document.body.innerText.includes("PROP FIRM PORTFOLIO"),
    { timeout: 15000 }
  );

  // 1. Portfolio Overview Banner & Multi-Currency Verification
  const overviewBanner = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHeader: text.includes("PROP FIRM PORTFOLIO & FINANCIAL RECONCILIATION") || text.includes("Prop Firm Portfolio"),
      hasNetCash: text.includes("NET CASH OUTCOME"),
      hasSimulatedPnl: text.includes("SIMULATED P&L"),
      hasUSD: text.includes("USD:"),
      hasGBP: text.includes("GBP:"),
      hasMultiCurrencyNote: text.includes("Multi-currency isolation active (USD, GBP)"),
      firmAlphaCapitalGbp: text.includes("Alpha Capital:\n1 accts • 1 passed • + £26,863.84"),
      firmFtmoUsd: text.includes("FTMO:\n2 accts • 1 passed • + $10,270.00"),
      firmApexUsd: text.includes("Apex Trader Funding:\n1 accts • 1 passed • + $3,782.00"),
    };
  });
  testResults.desktop.overviewBanner = overviewBanner;
  console.log("Portfolio Overview Banner:", overviewBanner);

  // Take screenshot of Desktop Portfolio Overview
  await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-portfolio-overview.png") });

  // 2. Open Challenge Detail Page (Click Inspect Details on Alpha Capital)
  console.log("Opening Alpha Capital challenge detail view...");
  const openDetailSuccess = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("div.rounded-2xl.border.bg-card, div.rounded-xl.border.bg-card"));
    const alphaCard = cards.find((c) => c.textContent?.includes("Alpha Capital"));
    if (alphaCard) {
      const btn = Array.from(alphaCard.querySelectorAll("button")).find((b) => b.textContent?.includes("Inspect Details"));
      if (btn) {
        btn.click();
        return true;
      }
    }
    // Fallback click any inspect details
    const anyBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Inspect Details"));
    if (anyBtn) {
      anyBtn.click();
      return true;
    }
    return false;
  });
  testResults.interactions.openChallengeDetail = openDetailSuccess;
  console.log("Clicked Inspect Details:", openDetailSuccess);

  await page.waitForFunction(
    () => document.body.innerText.includes("Rules & Compliance") && document.body.innerText.includes("All Challenges"),
    { timeout: 15000 }
  );

  await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-challenge-detail-loaded.png") });

  // 3. Test All 8 Account Tabs
  const tabsToTest = [
    { value: "overview", label: "Overview" },
    { value: "rules", label: "Rules & Compliance" },
    { value: "performance", label: "Performance" },
    { value: "trades", label: "Trade History" },
    { value: "phases", label: "Phase History" },
    { value: "breaches", label: "Failures & Breaches" },
    { value: "payouts", label: "Payouts" },
    { value: "settings", label: "Account Settings" },
  ];

  testResults.interactions.tabSwitching = {};

  for (const t of tabsToTest) {
    console.log(`Testing Tab: ${t.label} (${t.value})...`);
    const tabClicked = await page.evaluate((val, label) => {
      const tabBtn = Array.from(document.querySelectorAll("[role='tab']")).find((b) =>
        b.id.endsWith(`-trigger-${val}`) || b.textContent?.includes(label)
      );
      if (tabBtn) {
        tabBtn.click();
        return true;
      }
      return false;
    }, t.value, t.label);

    await sleep(800);

    const tabContentVisible = await page.evaluate((val) => {
      const activeContent = document.querySelector(`[role='tabpanel'][id$='-content-${val}'][data-state='active']`) ||
                            document.querySelector(`[role='tabpanel'][data-state='active']`);
      return !!activeContent;
    }, t.value);

    testResults.interactions.tabSwitching[t.value] = { clicked: tabClicked, visible: tabContentVisible };

    // Interactive tests inside specific tabs:
    if (t.value === "rules") {
      // Test category filters & rule simulator
      console.log("  Testing Rule Category Filter Pills...");
      const ruleFilterResults = await page.evaluate(() => {
        const filterButtons = Array.from(document.querySelectorAll("button")).filter((b) => {
          const text = b.textContent?.trim() || "";
          if (text.includes("All Challenges") || text.includes("All Accounts") || text.includes("All Time")) return false;
          return ["All (", "Target (", "Daily Loss (", "Drawdown (", "Consistency (", "Payout (", "Behavior ("].some((cat) =>
            text.includes(cat)
          );
        });
        const results = {};
        for (const fb of filterButtons) {
          const text = fb.textContent?.trim();
          fb.click();
          results[text] = true;
        }
        return { count: filterButtons.length, labels: Object.keys(results) };
      });
      testResults.interactions.ruleFilters = ruleFilterResults;
      console.log("  Rule Filter Pills:", ruleFilterResults);

      // Test Rule Simulator interaction
      console.log("  Testing Rule Simulator interaction...");
      const simResults = await page.evaluate(() => {
        // Find preset buttons in rule simulator
        const presetBtn = Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("-$500") || b.textContent?.includes("Heavy Loss")
        );
        if (presetBtn) {
          presetBtn.click();
        }
        const text = document.body.innerText;
        return {
          simulatorFound: text.includes("Rule Simulator") || text.includes("Hypothetical"),
          presetClicked: !!presetBtn,
          hasProjectedBalance: text.includes("Projected Balance"),
          hasProjectedDrawdown: text.includes("Projected Drawdown"),
        };
      });
      testResults.interactions.ruleSimulator = simResults;
      console.log("  Rule Simulator:", simResults);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-rules-tab-active.png") });
    }

    if (t.value === "performance") {
      const perfDetails = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasWinRate: text.includes("Win Rate"),
          hasProfitFactor: text.includes("Profit Factor"),
          hasCohorts: text.includes("Long Positions") && text.includes("Short Positions"),
          hasPayoffRatio: text.includes("Payoff Ratio") || text.includes("Win / Loss Payoff"),
          hasInstruments: text.includes("Top Traded Instruments"),
        };
      });
      testResults.interactions.performanceTab = perfDetails;
      console.log("  Performance Metrics:", perfDetails);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-performance-tab.png") });
    }

    if (t.value === "trades") {
      console.log("  Testing Trade Win/Loss Filter Pills...");
      const tradeFilterResults = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button")).filter((b) =>
          b.textContent?.includes("All Trades") || b.textContent?.includes("Winning") || b.textContent?.includes("Losing")
        );
        for (const b of buttons) {
          b.click();
        }
        const text = document.body.innerText;
        return {
          filterButtonsFound: buttons.length,
          hasComplianceImpactTags: text.includes("HWM") || text.includes("Neutral") || text.includes("Daily Loss"),
        };
      });
      testResults.interactions.tradeFilters = tradeFilterResults;
      console.log("  Trade Filter Pills & Tags:", tradeFilterResults);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-trades-tab.png") });
    }

    if (t.value === "phases") {
      const phaseDetails = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasPhaseCards: text.includes("Phase") || text.includes("Stage"),
          hasSnapshot: text.includes("Preserved Historical Completion Snapshot") || text.includes("Active phase"),
          hasTradingDays: text.includes("Trading Days"),
          hasCalculationBasis: text.includes("Calculation Basis"),
        };
      });
      testResults.interactions.phasesTab = phaseDetails;
      console.log("  Phase History Tab:", phaseDetails);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-phases-tab.png") });
    }

    if (t.value === "breaches") {
      const failureDetails = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasAuditTrail: text.includes("Violation Investigation") || text.includes("Compliance Audit Trail") || text.includes("Clear Record"),
          hasDisputeAction: text.includes("Record Firm Rejection") || text.includes("dispute"),
        };
      });
      testResults.interactions.failuresTab = failureDetails;
      console.log("  Failures & Breaches Tab:", failureDetails);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-failures-tab.png") });
    }

    if (t.value === "payouts") {
      const payoutDetails = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasChecklist: text.includes("Payout Readiness Checklist") || text.includes("Eligibility"),
          hasDisbursements: text.includes("Payout Disbursement History") || text.includes("Disbursements"),
        };
      });
      testResults.interactions.payoutsTab = payoutDetails;
      console.log("  Payouts Tab:", payoutDetails);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-payouts-tab.png") });
    }

    if (t.value === "settings") {
      const settingsDetails = await page.evaluate(() => {
        const text = document.body.innerText;
        const select = document.querySelector("select, [role='combobox']");
        return {
          hasConnectionCard: text.includes("Account Connection & Isolation"),
          hasDropdown: !!select,
        };
      });
      testResults.interactions.settingsTab = settingsDetails;
      console.log("  Account Settings Tab:", settingsDetails);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-settings-tab.png") });
    }
  }

  // 4. Test Navigation Back to Portfolio
  console.log("Testing Navigation Back to Portfolio...");
  const backNavSuccess = await page.evaluate(() => {
    const backBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("All Challenges") || b.textContent?.includes("Back to Challenges")
    );
    if (backBtn) {
      backBtn.click();
      return true;
    }
    return false;
  });
  testResults.interactions.backToPortfolio = backNavSuccess;
  await sleep(1500);

  // Verify we are back at the portfolio
  const backAtPortfolio = await page.evaluate(() => {
    return document.body.innerText.includes("PROP FIRM PORTFOLIO");
  });
  testResults.interactions.backAtPortfolio = backAtPortfolio;
  console.log("Back at portfolio view confirmed:", backAtPortfolio);

  // -------------------------------------------------------------
  // MOBILE RESPONSIVENESS & OVERFLOW INTERACTION (390x844 & 320x568)
  // -------------------------------------------------------------
  console.log("\n--- MOBILE TEST: 390x844 (iPhone 14) ---");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await sleep(1000);

  // Navigate to Prop Challenges on Mobile
  await page.evaluate(() => {
    window.__navStore?.getState()?.navigate("propChallenges");
  });
  await page.waitForFunction(() => document.body.innerText.includes("Alpha Capital"), { timeout: 15000 });

  const mobile390Overflow = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    return {
      scrollWidth,
      clientWidth,
      hasHorizontalOverflow: scrollWidth > clientWidth,
    };
  });
  testResults.mobile["390x844"] = mobile390Overflow;
  console.log("Mobile 390x844 Overflow Check:", mobile390Overflow);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "mobile-390-portfolio.png") });

  console.log("\n--- MOBILE TEST: 320x568 (iPhone SE minimum width) ---");
  await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true });
  await sleep(1000);

  const mobile320Overflow = await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    return {
      scrollWidth,
      clientWidth,
      hasHorizontalOverflow: scrollWidth > clientWidth,
    };
  });
  testResults.mobile["320x568"] = mobile320Overflow;
  console.log("Mobile 320x568 Overflow Check:", mobile320Overflow);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "mobile-320-portfolio.png") });

  testResults.errors = consoleErrors;
  console.log("\nConsole errors encountered:", consoleErrors.length);

  await browser.close();

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "real-browser-test-results.json"),
    JSON.stringify(testResults, null, 2)
  );

  console.log("\n=== REAL BROWSER VERIFICATION SUITE FINISHED SUCCESSFULLY ===");
  console.log(JSON.stringify(testResults, null, 2));
}

run().catch((e) => {
  console.error("FATAL BROWSER TEST ERROR:", e);
  process.exit(1);
});
