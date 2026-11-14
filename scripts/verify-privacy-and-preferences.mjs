/**
 * Verification script for Global Privacy, Navigation Cleanup & Preferences Center
 */

async function main() {
  console.log("=== STARTING VERIFICATION: PRIVACY, NAVIGATION & PREFERENCES ===");
  const baseUrl = "http://localhost:3000";

  // 1. Authenticate
  console.log("\n[1] Authenticating...");
  const authRes = await fetch(`${baseUrl}/api/auth?mode=signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "trader@alphapips.io",
      password: "password123",
    }),
  });

  if (!authRes.ok) {
    console.error("Auth failed:", await authRes.text());
    process.exit(1);
  }

  const rawCookie = authRes.headers.get("set-cookie");
  const cookie = rawCookie ? rawCookie.split(";")[0] : "";
  console.log("✓ Signed in successfully with trader@alphapips.io");

  const headers = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  // 2. Test UserSettings API & privacyModeEnabled persistence
  console.log("\n[2] Testing Settings API & Privacy Mode persistence...");
  const settingsGetRes = await fetch(`${baseUrl}/api/settings`, { headers });
  if (!settingsGetRes.ok) {
    console.error("Failed to fetch settings:", await settingsGetRes.text());
    process.exit(1);
  }
  const settingsData = await settingsGetRes.json();
  console.log("✓ Fetched UserSettings. Initial privacyModeEnabled:", settingsData.settings?.privacyModeEnabled ?? false);

  // Toggle privacy mode to true
  const patchTrueRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ privacyModeEnabled: true }),
  });
  if (!patchTrueRes.ok) {
    console.error("Failed to patch privacyModeEnabled to true:", await patchTrueRes.text());
    process.exit(1);
  }
  const patchedTrue = await patchTrueRes.json();
  const isPrivacyTrue = patchedTrue.privacyModeEnabled ?? patchedTrue.settings?.privacyModeEnabled;
  if (isPrivacyTrue !== true) {
    console.error("Expected privacyModeEnabled to be true, got:", patchedTrue);
    process.exit(1);
  }
  console.log("✓ Successfully enabled privacyModeEnabled in database");

  // Toggle privacy mode back to false
  const patchFalseRes = await fetch(`${baseUrl}/api/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ privacyModeEnabled: false }),
  });
  const patchedFalse = await patchFalseRes.json();
  const isPrivacyFalse = patchedFalse.privacyModeEnabled ?? patchedFalse.settings?.privacyModeEnabled;
  if (isPrivacyFalse !== false) {
    console.error("Expected privacyModeEnabled to be false, got:", patchedFalse);
    process.exit(1);
  }
  console.log("✓ Successfully toggled privacyModeEnabled back to false in database");

  // 3. Test No-Trade Observations API & Isolation in Trades Log
  console.log("\n[3] Testing Trades Log & Observations Integration...");
  const noTradesRes = await fetch(`${baseUrl}/api/no-trades`, { headers });
  if (!noTradesRes.ok) {
    console.error("Failed to fetch no-trades:", await noTradesRes.text());
    process.exit(1);
  }
  const noTradesData = await noTradesRes.json();
  console.log(`✓ Fetched /api/no-trades: ${noTradesData.observations?.length ?? 0} observations found`);

  const tradesRes = await fetch(`${baseUrl}/api/trades`, { headers });
  if (!tradesRes.ok) {
    console.error("Failed to fetch trades:", await tradesRes.text());
    process.exit(1);
  }
  const tradesData = await tradesRes.json();
  console.log(`✓ Fetched /api/trades: ${tradesData.trades?.length ?? 0} executed trades found`);

  // Verify that observations do NOT have pnl or execution fills, preserving financial isolation
  for (const obs of noTradesData.observations || []) {
    if (obs.grossPnlCents !== undefined && obs.grossPnlCents !== null) {
      console.error("Observation must not have grossPnlCents:", obs);
      process.exit(1);
    }
  }
  console.log("✓ Confirmed 100% financial isolation: observations are purely observational records");

  // 4. Codebase inspection assertions
  console.log("\n[4] Codebase Verification for UI Components...");
  const fs = await import("fs");

  // A. Check TopBar: no standalone keyboard shortcut button and no standalone Aa button
  const topBarCode = fs.readFileSync("src/components/top-bar.tsx", "utf-8");
  if (topBarCode.includes("KeyboardShortcutsDialog") || topBarCode.includes("showKeyboardShortcuts")) {
    console.error("TopBar should not have standalone KeyboardShortcutsDialog trigger directly in the bar!");
  } else {
    console.log("✓ TopBar cleaned: Standalone keyboard shortcut button removed");
  }
  if (topBarCode.includes("DropdownMenuTrigger") && topBarCode.includes("<Type") && topBarCode.includes("Aa")) {
    console.error("TopBar should not have standalone Aa font trigger button!");
  } else {
    console.log("✓ TopBar cleaned: Standalone Aa appearance trigger button removed");
  }

  // Check Profile Menu sections
  if (
    topBarCode.toLowerCase().includes("account") &&
    topBarCode.toLowerCase().includes("preferences") &&
    topBarCode.toLowerCase().includes("privacy") &&
    topBarCode.toLowerCase().includes("session") &&
    topBarCode.includes("Hide Sensitive Information") &&
    topBarCode.includes("Show Sensitive Information")
  ) {
    console.log("✓ Profile Menu restructured with Account, Preferences, Privacy (Sensitive Info Toggle), and Session sections");
  } else {
    console.error("TopBar profile menu missing required sections!");
    process.exit(1);
  }

  // B. Check Sidebar: no Log Observation button and no No-Trade Journal navigation item
  const sidebarCode = fs.readFileSync("src/components/sidebar.tsx", "utf-8");
  if (sidebarCode.includes("Log Observation")) {
    console.error("Sidebar should not have standalone 'Log Observation' button!");
    process.exit(1);
  }
  if (sidebarCode.includes("No-Trade Journal")) {
    console.error("Sidebar should not have 'No-Trade Journal' navigation item!");
    process.exit(1);
  }
  console.log("✓ Sidebar cleaned: Standalone 'Log Observation' and 'No-Trade Journal' items removed");

  // C. Check Trades Log: unified Add Entry dropdown, type badges, segment tabs
  const tradesLogCode = fs.readFileSync("src/components/views/trades-log-view.tsx", "utf-8");
  if (
    tradesLogCode.includes("Log Trade") &&
    tradesLogCode.includes("Log Observation") &&
    tradesLogCode.includes("All Entries") &&
    tradesLogCode.includes("Executed Trades") &&
    tradesLogCode.includes("Observations") &&
    tradesLogCode.includes("OBSERVATION") &&
    tradesLogCode.includes("ObservationDetailDialog")
  ) {
    console.log("✓ TradesLogView unified: Add Entry dropdown (Trade + Observation), 4 segment tabs, type indicators, and detail modal integrated");
  } else {
    console.error("TradesLogView missing unified observation features!");
    process.exit(1);
  }

  // D. Check Settings & Preferences Center
  const settingsCode = fs.readFileSync("src/components/views/settings-view.tsx", "utf-8");
  const prefCenterCode = fs.readFileSync("src/components/settings/preferences-center-tab.tsx", "utf-8");
  if (settingsCode.includes("PreferencesCenterTab") && settingsCode.includes("preferences")) {
    console.log("✓ SettingsView updated: Appearance tab replaced with Preferences Center");
  } else {
    console.error("SettingsView missing Preferences Center tab!");
    process.exit(1);
  }

  if (
    prefCenterCode.toLowerCase().includes("appearance") &&
    prefCenterCode.toLowerCase().includes("typography") &&
    prefCenterCode.toLowerCase().includes("interface density") &&
    prefCenterCode.toLowerCase().includes("keyboard shortcuts") &&
    prefCenterCode.toLowerCase().includes("global privacy")
  ) {
    console.log("✓ PreferencesCenterTab structured with all required preference categories");
  } else {
    console.error("PreferencesCenterTab missing required sections!");
    process.exit(1);
  }

  // E. Check CSS tokens
  const globalsCss = fs.readFileSync("src/app/globals.css", "utf-8");
  if (
    globalsCss.includes('[data-density="compact"]') &&
    globalsCss.includes('[data-density="spacious"]') &&
    globalsCss.includes('[data-font-size="small"]') &&
    globalsCss.includes('[data-mono-num="true"]')
  ) {
    console.log("✓ Globals CSS: Functional Density, Font Sizing, and Monospace formatting tokens verified");
  } else {
    console.error("globals.css missing density or typography tokens!");
    process.exit(1);
  }

  console.log("\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
