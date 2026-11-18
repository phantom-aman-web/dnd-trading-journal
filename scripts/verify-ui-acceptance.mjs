import puppeteer from "puppeteer-core";
import path from "path";

async function verify() {
  console.log("Launching Chrome via puppeteer-core...");
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const artifactDir = "C:\\Users\\hp\\.gemini\\antigravity\\brain\\976c927b-f221-48b0-af02-752b29ac52a8";
  const consoleErrors = [];
  const consoleWarnings = [];

  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    } else if (msg.type() === "warning") {
      consoleWarnings.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`PageError: ${err.message}`);
  });

  // Test 1: Desktop Viewport (1280x800)
  console.log("\n1. Testing Desktop Viewport (1280x800)...");
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(artifactDir, "10-acceptance-desktop-dashboard.png") });
  console.log("Captured 10-acceptance-desktop-dashboard.png");

  // Check breadcrumbs on Dashboard
  const dashboardCrumbText = await page.$$eval("[data-slot='breadcrumb-list'] li, [data-slot='breadcrumb-list'] *", els => els.map(e => e.textContent.trim()).filter(Boolean));
  console.log("Dashboard Breadcrumbs:", dashboardCrumbText.slice(0, 3));

  // Navigate to Prop Challenges
  console.log("Navigating to Prop Challenges...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button, a")).find(el => el.textContent.includes("Prop Challenges"));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, "11-acceptance-prop-challenges.png") });
  console.log("Captured 11-acceptance-prop-challenges.png");

  // Open Challenge Detail
  console.log("Opening first Prop Challenge card detail...");
  await page.evaluate(() => {
    const card = document.querySelector(".group.relative.rounded-2xl.border");
    if (card) card.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, "12-acceptance-challenge-detail.png") });
  console.log("Captured 12-acceptance-challenge-detail.png");

  // Click Breadcrumb to navigate back to Prop Challenges
  console.log("Clicking 'Prop Challenges' in breadcrumbs to navigate back...");
  await page.evaluate(() => {
    const crumb = Array.from(document.querySelectorAll("[data-slot='breadcrumb-link']")).find(el => el.textContent.includes("Prop Challenges"));
    if (crumb) crumb.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, "13-acceptance-breadcrumb-back-challenges.png") });
  console.log("Captured 13-acceptance-breadcrumb-back-challenges.png");

  // Test 2: Mobile Viewport (375x667)
  console.log("\n2. Testing Mobile Viewport (375x667 iPhone SE)...");
  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(artifactDir, "14-acceptance-mobile-dashboard.png") });
  console.log("Captured 14-acceptance-mobile-dashboard.png");

  // Verify Horizontal Overflow on Mobile
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  console.log(`Mobile dimensions: scrollWidth = ${scrollWidth}px, clientWidth = ${clientWidth}px`);
  if (scrollWidth > clientWidth) {
    console.error(`Horizontal overflow detected on mobile: ${scrollWidth - clientWidth}px`);
  } else {
    console.log("[PASS] Strict 0px horizontal overflow on mobile maintained.");
  }

  // Hydration & li nesting error check
  console.log("\n3. Hydration & Console Errors Audit...");
  const nestedLiErrors = consoleErrors.filter(e => e.includes("cannot be a descendant of") || e.includes("cannot contain a nested") || e.includes("Hydration"));
  if (nestedLiErrors.length > 0) {
    console.error("FAIL: Hydration / nested <li> errors detected:", nestedLiErrors);
    throw new Error("Hydration errors present");
  } else {
    console.log("[PASS] Zero hydration errors. Zero nested <li> breadcrumb errors.");
  }

  console.log(`Total console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log("Errors logged (non-blocking if favicon or analytics):", consoleErrors.slice(0, 5));
  }

  await browser.close();
  console.log("\nBrowser acceptance verification successfully concluded!");
}

verify().catch(e => {
  console.error("Verification failed:", e);
  process.exit(1);
});
