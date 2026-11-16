import { spawn } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  const outDir = path.join(process.cwd(), "verification-screenshots", "landing-updated");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const proc = spawn(edgePath, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-fre",
    "--guest",
    "--window-size=1440,900",
    "--remote-debugging-port=9224",
    "http://localhost:3000"
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  try {
    const listRes = await fetch("http://127.0.0.1:9224/json");
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.result);
        callbacks.delete(data.id);
      }
    };

    await new Promise((r) => (ws.onopen = r));

    function send(method, params = {}) {
      const msgId = id++;
      return new Promise((resolve) => {
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    async function evalCode(expression) {
      const res = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res?.result?.value;
    }

    await send("Page.enable");
    await send("Runtime.enable");

    // Dismiss cookie banner
    await evalCode(`
      localStorage.setItem('dnd-cookie-consent', JSON.stringify({ choice: 'all', timestamp: Date.now(), preferences: { essential: true, functional: true, analytics: true } }));
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Accept all'));
      if (btn) btn.click();
    `);

    await new Promise((r) => setTimeout(r, 800));

    // Capture sections
    const sections = [
      { name: "01-landing-hero", scrollY: 0 },
      { name: "02-landing-intro-capabilities", scrollY: 850 },
      { name: "03-landing-journal", scrollY: 1800 },
      { name: "04-landing-analytics", scrollY: 2800 },
      { name: "05-landing-strategy", scrollY: 3800 },
      { name: "06-landing-tools", scrollY: 4800 },
      { name: "07-landing-multimarket", scrollY: 5700 },
      { name: "08-landing-cta-footer", scrollY: 6600 },
    ];

    for (const sec of sections) {
      await evalCode(`window.scrollTo(0, ${sec.scrollY})`);
      await new Promise((r) => setTimeout(r, 600));

      const shot = await send("Page.captureScreenshot", { format: "png" });
      if (shot?.data) {
        const filePath = path.join(outDir, `${sec.name}.png`);
        fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
        console.log(`Saved screenshot: ${filePath}`);
      }
    }

    // Verify DOM text and color classes
    const domCheck = await evalCode(`(() => {
      const text = document.body.innerText;
      const html = document.body.innerHTML;
      const hasPurpleClasses = /text-purple-|bg-purple-|border-purple-|from-purple-|to-purple-|via-purple-|shadow-purple-/.test(html);
      const hasVioletClasses = /text-violet-|bg-violet-|border-violet-|from-violet-|to-violet-|via-violet-/.test(html);
      const hasDailyPlans = text.includes("Daily Plans") || text.includes("Daily Plan");
      const hasStandaloneReviews = text.includes("Standalone Review") || text.includes("Individual Trade Review");
      const hasAnalyticsDomains = text.includes("Performance & Expectancy") && text.includes("Risk & Capital");
      return {
        hasPurpleClasses,
        hasVioletClasses,
        hasDailyPlans,
        hasStandaloneReviews,
        hasAnalyticsDomains,
        title: document.title
      };
    })()`);

    console.log("DOM Verification results:", domCheck);

    ws.close();
  } finally {
    proc.kill();
  }
}

main().catch(console.error);
