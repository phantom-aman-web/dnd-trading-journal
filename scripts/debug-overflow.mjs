import puppeteer from "puppeteer-core";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function inspectOverflow(width, height) {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1000));

  const culprits = await page.evaluate((vpWidth) => {
    const doc = document.documentElement;
    const body = document.body;
    const elements = Array.from(document.querySelectorAll("*"));
    const overflowing = [];

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.right > vpWidth + 2) {
        overflowing.push({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          right: rect.right,
          width: rect.width,
          text: (el.textContent || "").slice(0, 40).trim(),
        });
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      clientWidth: doc.clientWidth,
      topCulprits: overflowing.sort((a, b) => b.right - a.right).slice(0, 10),
    };
  }, width);

  console.log(`\n=== Culprits at ${width}x${height} ===`);
  console.log(`scrollWidth: ${culprits.scrollWidth}, clientWidth: ${culprits.clientWidth}`);
  console.log("Top overflowing elements:", culprits.topCulprits);

  await browser.close();
}

async function main() {
  await inspectOverflow(360, 740);
  await inspectOverflow(768, 1024);
}

main().catch(console.error);
