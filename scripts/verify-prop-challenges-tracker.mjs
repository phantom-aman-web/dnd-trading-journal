import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUTPUT_DIR = path.resolve("./artifacts/prop-challenges-verification");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImJpamlzdGVyYm9zY2hAZ21haWwuY29tIiwic3ViIjoiY211MnpmeXYyMDAwMGw1MDRpYTZkajkwayIsImlhdCI6MTc5NDg5MjY2NywiZXhwIjoxNzk3NDg0NjY3fQ.RkXgwDC3K-hFK_pJxoYpFLrnOW1yBsRTwLv8cKfVe6U";

async function run() {
  console.log("=== RUNNING RIGOROUS PROP CHALLENGE TRACKER VERIFICATION ===");
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

  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await page.waitForSelector("header", { timeout: 10000 });

  // 1. Navigate to Prop Challenges
  console.log("Navigating to Prop Challenges view...");
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const propBtn = btns.find(b => b.textContent?.includes("Prop Challenges"));
    if (propBtn) {
      propBtn.click();
      return true;
    }
    return false;
  });
  if (!clicked) {
    throw new Error("Could not find Prop Challenges navigation button!");
  }
  
  // Wait for challenge cards to finish loading and appear
  console.log("Waiting for Prop Challenge cards to render...");
  await page.waitForSelector(".grid.grid-cols-1.md\\:grid-cols-2 > div.rounded-xl.border.bg-card", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1000));

  // Take screenshot of Prop Challenges view
  await page.screenshot({ path: path.join(OUTPUT_DIR, `prop_challenges_populated.png`), fullPage: true });

  // Inspect the challenge cards on page
  const challengeData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".grid.grid-cols-1.md\\:grid-cols-2 > div.rounded-xl.border.bg-card"));
    return cards.map(c => {
      const title = c.querySelector("h3")?.textContent?.trim();
      const badge = c.querySelector("h3")?.parentElement?.querySelector(".inline-flex")?.textContent?.trim();
      const text = c.textContent?.trim().replace(/\s+/g, " ") || "";

      // Extract specific metric numbers
      const hasBalance = text.includes("Current Balance") && !text.includes("Current Balance $0.00");
      const hasNetPnl = text.includes("Total Net P&L") && !text.includes("Total Net P&L $0.00");
      const hasExecutions = text.includes("Executions") && !/\b0 trades\b/.test(text);
      const hasGauges = text.includes("Profit Target") && text.includes("Daily Loss") && text.includes("Max Drawdown");
      const hasPassedBadge = badge?.includes("Passed");

      return {
        title,
        badge,
        hasBalance,
        hasNetPnl,
        hasExecutions,
        hasGauges,
        hasPassedBadge,
        summary: text.slice(0, 350),
      };
    });
  });

  console.log(`Found ${challengeData.length} challenge cards on page:`);
  challengeData.forEach((c, idx) => {
    console.log(`\nCard ${idx + 1}: ${c.title} [${c.badge}]`);
    console.log(`  Has Balance: ${c.hasBalance}`);
    console.log(`  Has Net PnL: ${c.hasNetPnl}`);
    console.log(`  Has Executions: ${c.hasExecutions}`);
    console.log(`  Has Gauges: ${c.hasGauges}`);
    console.log(`  Summary: ${c.summary}...`);
  });

  if (challengeData.length !== 3) {
    throw new Error(`Expected exactly 3 challenge cards, but found ${challengeData.length}!`);
  }

  for (const c of challengeData) {
    if (!c.hasBalance) throw new Error(`Card "${c.title}" is missing real balance data!`);
    if (!c.hasNetPnl) throw new Error(`Card "${c.title}" is missing real Net P&L data!`);
    if (!c.hasExecutions) throw new Error(`Card "${c.title}" is missing real trade execution count!`);
    if (!c.hasGauges) throw new Error(`Card "${c.title}" is missing rule gauges!`);
  }

  // Check for any runtime errors
  if (errors.length > 0) {
    throw new Error(`Browser reported errors: ${errors.join("; ")}`);
  }

  // 2. Test Mobile Viewport (390px)
  console.log("\n--- Testing Mobile Viewport (390px) ---");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `prop_challenges_mobile.png`), fullPage: true });

  const mobileCheck = await page.evaluate(() => {
    const doc = document.documentElement;
    const scrollW = Math.max(doc.scrollWidth, document.body.scrollWidth);
    const clientW = doc.clientWidth;
    const cards = Array.from(document.querySelectorAll(".grid.grid-cols-1.md\\:grid-cols-2 > div.rounded-xl.border.bg-card"));
    return {
      overflow: scrollW > clientW + 2,
      cardsCount: cards.length,
    };
  });
  console.log("Mobile view check:", mobileCheck);
  if (mobileCheck.overflow) {
    throw new Error("Mobile view has horizontal overflow!");
  }
  if (mobileCheck.cardsCount !== 3) {
    throw new Error(`Expected 3 cards in mobile view, found ${mobileCheck.cardsCount}`);
  }

  await browser.close();
  console.log("\n=== ALL PROP CHALLENGES VERIFICATIONS PASSED 100%! ===");
}

run().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
