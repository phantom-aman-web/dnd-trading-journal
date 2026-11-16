const { chromium } = require('C:/Users/hp/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require("fs");
const path = require("path");

async function verifyFonts() {
  console.log("Launching Chromium for Font Verification...");
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/?view=dashboard ...");
  await page.goto("http://localhost:3000/?view=dashboard", { waitUntil: "networkidle", timeout: 30000 });

  // Await fonts.ready
  await page.evaluate(() => document.fonts.ready);

  const fontFamiliesToTest = [
    { key: "jetbrains", name: "JetBrains Mono", checkQuery: "16px 'JetBrains Mono'" },
    { key: "jakarta", name: "Plus Jakarta Sans", checkQuery: "16px 'Plus Jakarta Sans'" },
    { key: "playfair", name: "Playfair Display", checkQuery: "16px 'Playfair Display'" },
    { key: "cinzel", name: "Cinzel", checkQuery: "16px 'Cinzel'" },
    { key: "inter", name: "Inter", checkQuery: "16px 'Inter'" },
    { key: "system", name: "System Sans", checkQuery: "16px system-ui" },
  ];

  const results = [];

  for (const f of fontFamiliesToTest) {
    const data = await page.evaluate(async (font) => {
      document.documentElement.setAttribute("data-font", font.key);
      // Wait for font load if needed
      if (font.name !== "System Sans") {
        try {
          await document.fonts.load(font.checkQuery);
        } catch (e) {}
      }

      const fontChecked = document.fonts.check(font.checkQuery);

      // Create test element to inspect computed style
      const testEl = document.createElement("div");
      testEl.innerText = "AlphaPips 12345 $#@! QWERTY glyphs rendering test";
      testEl.style.fontSize = "24px";
      testEl.style.fontWeight = "600";
      document.body.appendChild(testEl);

      const computed = window.getComputedStyle(testEl);
      const computedFont = computed.fontFamily;

      // Measure character rendering width via Canvas to guarantee distinct glyph metrics
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = `24px "${font.name}", sans-serif`;
      const textMetrics = ctx.measureText("AlphaPips 12345 $#@! QWERTY");

      document.body.removeChild(testEl);

      return {
        fontKey: font.key,
        fontName: font.name,
        fontChecked,
        computedFont,
        measuredWidth: textMetrics.width,
      };
    }, f);

    console.log(`[FONT] ${f.name} (key: ${f.key}): checked=${data.fontChecked}, computed="${data.computedFont}", measuredWidth=${data.measuredWidth.toFixed(2)}px`);
    results.push(data);
  }

  // Ensure each font family produced distinct glyph metrics
  const uniqueWidths = new Set(results.map(r => r.measuredWidth.toFixed(1)));
  console.log(`Unique font rendering widths count: ${uniqueWidths.size} / ${results.length}`);

  const outputDir = path.join(__dirname, "phase5-evidence");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "font-verification-results.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), fonts: results, uniqueMetricsCount: uniqueWidths.size }, null, 2)
  );

  await browser.close();
  console.log("Font verification complete!");
}

verifyFonts().catch((e) => {
  console.error("Font verification failed:", e);
  process.exit(1);
});
