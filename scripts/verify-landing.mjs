import { spawn } from "child_process";
import fs from "fs";

async function run() {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const proc = spawn(edgePath, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-fre",
    "--guest",
    "--window-size=1440,900",
    "--remote-debugging-port=9222",
    "http://localhost:3000"
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const listRes = await fetch("http://127.0.0.1:9222/json");
  const targets = await listRes.json();
  const pageTarget = targets.find(t => t.type === "page") || targets[0];

  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    console.error("No webSocketDebuggerUrl found");
    proc.kill();
    return;
  }

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

  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    const msgId = id++;
    return new Promise((resolve) => {
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send("Page.enable");
  await send("Runtime.enable");

  // Dismiss cookie banner
  await send("Runtime.evaluate", {
    expression: `
      localStorage.setItem('dnd-cookie-consent', JSON.stringify({ choice: 'all', timestamp: Date.now(), preferences: { essential: true, functional: true, analytics: true } }));
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept all'));
      if (btn) btn.click();
    `
  });
  await new Promise(r => setTimeout(r, 500));

  // 1. Setups / Strategy section
  await send("Runtime.evaluate", {
    expression: "document.getElementById('setups')?.scrollIntoView({ behavior: 'instant' });"
  });
  await new Promise(r => setTimeout(r, 500));
  const shotSetups = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("screenshot-setups-section.png", Buffer.from(shotSetups.data, "base64"));
  console.log("Captured screenshot-setups-section.png");

  // 2. Markets section
  await send("Runtime.evaluate", {
    expression: "document.getElementById('markets')?.scrollIntoView({ behavior: 'instant' });"
  });
  await new Promise(r => setTimeout(r, 500));
  const shotMarkets = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("screenshot-markets-section.png", Buffer.from(shotMarkets.data, "base64"));
  console.log("Captured screenshot-markets-section.png");

  // 3. Final CTA section
  await send("Runtime.evaluate", {
    expression: "document.querySelector('section:has(h2)')?.scrollIntoView({ behavior: 'instant' }); const cta = Array.from(document.querySelectorAll('section')).find(s => s.textContent.includes('deserves more than a spreadsheet')); if (cta) cta.scrollIntoView({ behavior: 'instant' });"
  });
  await new Promise(r => setTimeout(r, 500));
  const shotCta = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("screenshot-final-cta.png", Buffer.from(shotCta.data, "base64"));
  console.log("Captured screenshot-final-cta.png");

  // 4. Click Sign in to test auth modal/route
  await send("Runtime.evaluate", {
    expression: `
      const signinBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Sign in');
      if (signinBtn) signinBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 800));
  const shotSignin = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("screenshot-auth-signin.png", Buffer.from(shotSignin.data, "base64"));
  console.log("Captured screenshot-auth-signin.png");

  // 5. Click "Back to home"
  await send("Runtime.evaluate", {
    expression: `
      const backBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Back to home'));
      if (backBtn) backBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 500));

  // 6. Test Mobile Viewport & Menu
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await send("Runtime.evaluate", {
    expression: "window.scrollTo(0, 0);"
  });
  await new Promise(r => setTimeout(r, 500));
  const shotMobileHome = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("screenshot-mobile-home.png", Buffer.from(shotMobileHome.data, "base64"));
  console.log("Captured screenshot-mobile-home.png");

  // Open mobile menu
  await send("Runtime.evaluate", {
    expression: `
      const menuBtn = document.querySelector('button[aria-label="Open menu"]');
      if (menuBtn) menuBtn.click();
    `
  });
  await new Promise(r => setTimeout(r, 600));
  const shotMobileMenu = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("screenshot-mobile-menu.png", Buffer.from(shotMobileMenu.data, "base64"));
  console.log("Captured screenshot-mobile-menu.png");

  ws.close();
  proc.kill();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
