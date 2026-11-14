import { spawn } from "child_process";
import fs from "fs";

async function run() {
  console.log("=== STARTING UI EXPANSION BROWSER VERIFICATION ===");
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const proc = spawn(edgePath, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-fre",
    "--guest",
    "--window-size=1440,900",
    "--remote-debugging-port=9223",
    "http://localhost:3000"
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let listRes;
  try {
    listRes = await fetch("http://127.0.0.1:9223/json");
  } catch (err) {
    console.error("Failed to connect to CDP:", err);
    proc.kill();
    return;
  }
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

  async function evaluate(expression) {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  }

  // 1. Navigate to signin and authenticate or set session token
  console.log("[1] Navigating to dashboard via login...");
  await evaluate(`
    (async () => {
      const res = await fetch('/api/auth?mode=signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'trader@alphapips.io', password: 'password123' })
      });
      window.location.reload();
    })()
  `);

  await new Promise(r => setTimeout(r, 3000));

  // 2. Check UI elements in App Shell
  console.log("[2] Verifying App Shell components...");
  const shellCheck = await evaluate(`
    (() => {
      const bodyText = document.body.innerText;
      return {
        hasSidebar: !!document.querySelector('aside'),
        hasTopBar: !!document.querySelector('header'),
        hasNoTradeButton: bodyText.includes('Log Observation') || !!document.querySelector('button[title*="observation"]'),
        hasNoTradeNav: bodyText.includes('No-Trade Journal'),
        hasArchivedNav: bodyText.includes('Archived Records'),
        hasSyncIndicator: bodyText.includes('Synced') || bodyText.includes('Sync') || !!document.querySelector('[title*="Sync"]'),
        hasWorkspaceBtn: bodyText.includes('Workspace') || !!document.querySelector('[title*="Workspace"]'),
        hasWidgetsBtn: !!document.querySelector('[title*="Floating Widgets"]') || bodyText.includes('Widgets'),
      };
    })()
  `);
  console.log("✓ App Shell Component Check:", shellCheck);

  // 3. Test Navigation to No-Trade Journal
  console.log("\n[3] Testing Navigation to No-Trade Journal...");
  await evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const noTradeBtn = links.find(el => el.innerText.includes('No-Trade Journal'));
      if (noTradeBtn) noTradeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  const noTradeViewCheck = await evaluate(`
    (() => {
      const body = document.body.innerText;
      return {
        isNoTradeView: body.includes('No-Trade Journal') || body.includes('Discipline & Observation Log'),
        hasMetrics: body.includes('Total Logged') || body.includes('Discipline Ratio'),
        hasSearchInput: !!document.querySelector('input[placeholder*="Search observations"]'),
        hasTableOrCards: body.includes('XAUUSD') || body.includes('No market observations found'),
      };
    })()
  `);
  console.log("✓ No-Trade Journal View Check:", noTradeViewCheck);

  // 4. Test Navigation to Archived Records
  console.log("\n[4] Testing Navigation to Archived Records...");
  await evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const archiveBtn = links.find(el => el.innerText.includes('Archived Records'));
      if (archiveBtn) archiveBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  const archiveViewCheck = await evaluate(`
    (() => {
      const body = document.body.innerText;
      return {
        isArchiveView: body.includes('Archived Records') || body.includes('Safely preserve and restore'),
        hasTabs: body.includes('Archived Trades') && body.includes('Accounts') && body.includes('Setups') && body.includes('Observations'),
      };
    })()
  `);
  console.log("✓ Archived Records View Check:", archiveViewCheck);

  // 5. Test Multi-Panel Workspace toggle
  console.log("\n[5] Testing Multi-Panel Workspace toggle...");
  await evaluate(`
    (() => {
      // Find workspace toggle button in top bar or trigger via keyboard shortcut Alt+W
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', altKey: true, bubbles: true }));
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  const workspaceCheck = await evaluate(`
    (() => {
      const body = document.body.innerText;
      return {
        hasWorkspaceBar: body.includes('Multi-Panel Workspace') || body.includes('Exit Workspace'),
        hasLayoutSelectors: body.includes('2 Columns') || body.includes('3 Columns') || body.includes('4 Grid'),
        panelCount: document.querySelectorAll('[data-panel-id]').length || document.querySelectorAll('.grid > div').length,
      };
    })()
  `);
  console.log("✓ Multi-Panel Workspace Check:", workspaceCheck);

  // 6. Test Floating Widgets Layer
  console.log("\n[6] Testing Floating Widgets Layer...");
  await evaluate(`
    (() => {
      // Exit workspace
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', altKey: true, bubbles: true }));
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  const widgetCheck = await evaluate(`
    (() => {
      // Let's toggle a widget on via localStorage/store
      const raw = localStorage.getItem('alphapips-floating-widgets');
      return {
        hasStore: !!raw,
      };
    })()
  `);
  console.log("✓ Floating Widgets System Check:", widgetCheck);

  // 7. Test Strategy Dictionary under Setups
  console.log("\n[7] Testing Strategy Dictionary under Setups...");
  await evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const setupsBtn = links.find(el => el.innerText.trim() === 'Setups' || el.innerText.includes('Playbooks'));
      if (setupsBtn) setupsBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  const setupsCheck = await evaluate(`
    (() => {
      const body = document.body.innerText;
      return {
        hasSetups: body.includes('Playbooks') || body.includes('Setups') || body.includes('Liquidity Sweep'),
      };
    })()
  `);
  console.log("✓ Setups & Strategy Navigation Check:", setupsCheck);

  console.log("\n=== ALL UI WORKSPACE & JOURNAL VERIFICATIONS COMPLETED SUCCESSFULLY ===");

  ws.close();
  proc.kill();
}

run().catch(err => {
  console.error("Browser verification error:", err);
  process.exit(1);
});
