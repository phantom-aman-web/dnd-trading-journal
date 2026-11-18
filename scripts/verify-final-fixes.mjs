import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUTPUT_DIR = path.resolve("./artifacts/final-fixes-snapshots");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImJpamlzdGVyYm9zY2hAZ21haWwuY29tIiwic3ViIjoiY211MnpmeXYyMDAwMGw1MDRpYTZkajkwayIsImlhdCI6MTc5NDg5MjY2NywiZXhwIjoxNzk3NDg0NjY3fQ.RkXgwDC3K-hFK_pJxoYpFLrnOW1yBsRTwLv8cKfVe6U";

async function run() {
  console.log("=== RUNNING RIGOROUS FINAL FIXES VERIFICATION ===");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  await page.setCookie({
    name: "dnd_session",
    value: TOKEN,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  // 1. Mobile Search Visibility across all narrow & standard widths
  const widthsToTest = [320, 360, 375, 390, 414, 430];
  console.log("\n--- Testing Mobile Search Icon Visibility across widths ---");

  for (const width of widthsToTest) {
    await page.setViewport({ width, height: 800, deviceScaleFactor: 2 });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
    await page.waitForSelector("header", { timeout: 10000 });

    const searchMetrics = await page.evaluate(() => {
      const mobileBtn = document.querySelector('header button[aria-label="Search"]');
      const desktopBar = document.querySelector('header button[title="Open Command Palette (⌘K or /)"].sm\\:flex, header button[title="Open Command Palette (⌘K or /)"].hidden');
      const doc = document.documentElement;
      const scrollW = Math.max(doc.scrollWidth, document.body.scrollWidth);
      const clientW = doc.clientWidth;

      if (!mobileBtn) return { found: false, overflow: scrollW > clientW + 2 };

      const rect = mobileBtn.getBoundingClientRect();
      const svg = mobileBtn.querySelector("svg");
      const svgRect = svg ? svg.getBoundingClientRect() : null;

      return {
        found: true,
        buttonWidth: rect.width,
        buttonHeight: rect.height,
        buttonVisible: rect.width > 0 && rect.height > 0,
        svgVisible: !!svg && (svgRect?.width ?? 0) > 0,
        overflow: scrollW > clientW + 2,
        scrollWidth: scrollW,
        clientWidth: clientW,
      };
    });

    console.log(`Width ${width}px:`);
    console.log(`  Search button visible: ${searchMetrics.buttonVisible} (${searchMetrics.buttonWidth}x${searchMetrics.buttonHeight}px)`);
    console.log(`  SVG icon visible: ${searchMetrics.svgVisible}`);
    console.log(`  Horizontal overflow: ${searchMetrics.overflow ? `YES (${searchMetrics.scrollWidth} > ${searchMetrics.clientWidth})` : "NO (0px)"}`);

    if (!searchMetrics.buttonVisible || !searchMetrics.svgVisible || searchMetrics.overflow) {
      throw new Error(`Search button test failed at ${width}px!`);
    }

    await page.screenshot({ path: path.join(OUTPUT_DIR, `search_visibility_${width}.png`) });
  }

  // 2. Top Profile Icon Navigation & Active Indicator on Mobile
  console.log("\n--- Testing Top Profile Icon Navigation on Mobile (390px) ---");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await page.waitForSelector("header", { timeout: 10000 });

  // Verify top profile button is present on mobile
  const profileButtonData = await page.evaluate(() => {
    const btn = document.querySelector('header button[aria-label="Account Profile"]');
    if (!btn) return { found: false };
    const rect = btn.getBoundingClientRect();
    return {
      found: true,
      visible: rect.width > 0 && rect.height > 0,
      width: rect.width,
      height: rect.height,
      ariaCurrent: btn.getAttribute("aria-current"),
    };
  });
  console.log("Top Profile button found on mobile:", profileButtonData);
  if (!profileButtonData.found || !profileButtonData.visible) {
    throw new Error("Top Profile button missing or invisible on mobile header!");
  }

  // Click top profile button
  console.log("Clicking top Profile icon...");
  await page.click('header button[aria-label="Account Profile"]');
  await new Promise((r) => setTimeout(r, 600));

  const afterProfileClick = await page.evaluate(() => {
    const btn = document.querySelector('header button[aria-label="Account Profile"]');
    const h1 = document.querySelector("h1");
    const activeTab = window.__NAV_STORE__?.getState()?.params?.tab;
    const view = window.__NAV_STORE__?.getState()?.view;
    return {
      ariaCurrent: btn?.getAttribute("aria-current"),
      h1Text: h1?.textContent,
      view,
      tab: activeTab,
    };
  });
  console.log("After Profile click:", afterProfileClick);
  if (afterProfileClick.view !== "settings" || afterProfileClick.tab !== "profile") {
    throw new Error(`Top Profile button did not navigate to settings profile tab! Got view=${afterProfileClick.view}, tab=${afterProfileClick.tab}`);
  }
  if (afterProfileClick.ariaCurrent !== "page") {
    throw new Error("Top Profile button aria-current is not 'page' when active!");
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, `mobile_profile_opened.png`) });

  // 3. Bottom Navigation Verification (Exactly 4 items, No Profile)
  console.log("\n--- Testing Bottom Navigation Structure (4 items, No Profile) ---");
  const bottomNavData = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile navigation"]');
    if (!nav) return { found: false };
    const buttons = Array.from(nav.querySelectorAll("button"));
    const buttonLabels = buttons.map((b) => b.textContent?.trim().replace(/\s+/g, " "));
    const hasProfile = buttonLabels.some((l) => l?.toLowerCase().includes("profile"));
    return {
      found: true,
      buttonCount: buttons.length,
      buttonLabels,
      hasProfile,
      gridCols: nav.querySelector("div")?.className,
    };
  });
  console.log("Bottom Navigation Data:", bottomNavData);
  if (bottomNavData.buttonCount !== 4) {
    throw new Error(`Expected exactly 4 buttons in bottom nav, found ${bottomNavData.buttonCount}`);
  }
  if (bottomNavData.hasProfile) {
    throw new Error("Profile button was NOT removed from bottom nav!");
  }

  // 4. Keyboard Shortcuts Visibility (Mobile vs Desktop)
  console.log("\n--- Testing Keyboard Shortcuts Visibility: Mobile vs Desktop ---");

  // On Mobile: navigate to preferences
  await page.evaluate(() => {
    window.__NAV_STORE__?.getState()?.navigate("settings", { tab: "preferences" });
  });
  await new Promise((r) => setTimeout(r, 600));

  const mobileShortcutsCheck = await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("Shortcuts"));
    const visiblePills = pills.filter((p) => {
      const style = window.getComputedStyle(p);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    const heading = Array.from(document.querySelectorAll("h2")).find((h) => h.textContent?.includes("Keyboard Shortcuts"));
    const headingParent = heading?.closest("div.rounded-xl");
    const headingVisible = headingParent ? window.getComputedStyle(headingParent).display !== "none" : false;

    return {
      visiblePillsCount: visiblePills.length,
      headingVisible,
    };
  });
  console.log("Mobile (390px) Keyboard Shortcuts visibility:", mobileShortcutsCheck);
  if (mobileShortcutsCheck.visiblePillsCount > 0 || mobileShortcutsCheck.headingVisible) {
    throw new Error("Keyboard Shortcuts are visible on mobile Preferences, but must be hidden!");
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, `mobile_preferences_no_shortcuts.png`) });

  // On Desktop (1440px):
  console.log("Switching to Desktop (1440px) to verify Keyboard Shortcuts remain available...");
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 600));

  const desktopShortcutsCheck = await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("Shortcuts"));
    const visiblePills = pills.filter((p) => {
      const style = window.getComputedStyle(p);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    const heading = Array.from(document.querySelectorAll("h2")).find((h) => h.textContent?.includes("Keyboard Shortcuts"));
    const headingParent = heading?.closest("div.rounded-xl");
    const headingVisible = headingParent ? window.getComputedStyle(headingParent).display !== "none" : false;

    // Desktop top dropdown check
    const desktopProfileTrigger = document.querySelector('.hidden.md\\:block button, div:not(.md\\:hidden) > button[aria-haspopup="menu"]');

    return {
      visiblePillsCount: visiblePills.length,
      headingVisible,
      desktopProfileTriggerFound: !!desktopProfileTrigger,
    };
  });
  console.log("Desktop (1440px) Keyboard Shortcuts visibility:", desktopShortcutsCheck);
  if (desktopShortcutsCheck.visiblePillsCount === 0 || !desktopShortcutsCheck.headingVisible) {
    throw new Error("Keyboard Shortcuts are hidden on Desktop Preferences, but must be visible!");
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, `desktop_preferences_with_shortcuts.png`) });

  await browser.close();
  console.log("\n=== ALL FINAL FIXES BROWSER VERIFICATIONS PASSED 100%! ===");
}

run().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
