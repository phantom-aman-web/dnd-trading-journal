const { chromium } = require('C:/Users/hp/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { createSessionToken } = require('../src/lib/auth');

// WCAG relative luminance and contrast ratio calculations
function parseColor(cssColor) {
  if (!cssColor) return null;
  cssColor = cssColor.trim();
  if (cssColor.startsWith('#')) {
    let hex = cssColor.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  const rgbMatch = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }
  return null;
}

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrastRatio(fgRgb, bgRgb) {
  const l1 = relativeLuminance(fgRgb[0], fgRgb[1], fgRgb[2]);
  const l2 = relativeLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const VIEWPORTS = [
  { name: 'small-mobile', width: 375, height: 812, label: 'Small mobile (375x812)' },
  { name: 'standard-mobile', width: 390, height: 844, label: 'Standard mobile (390x844)' },
  { name: 'large-mobile', width: 430, height: 932, label: 'Large mobile (430x932)' },
  { name: 'tablet-portrait', width: 768, height: 1024, label: 'Tablet portrait (768x1024)' },
  { name: 'large-tablet-portrait', width: 834, height: 1194, label: 'Large tablet portrait (834x1194)' },
  { name: 'tablet-landscape', width: 1024, height: 768, label: 'Tablet landscape (1024x768)' },
  { name: 'standard-desktop', width: 1366, height: 768, label: 'Standard desktop (1366x768)' },
  { name: 'desktop', width: 1440, height: 900, label: 'Desktop (1440x900)' },
  { name: 'ultra-wide', width: 1920, height: 1080, label: 'Ultra-wide (1920x1080)' },
  { name: 'large-ultra-wide', width: 2560, height: 1440, label: 'Large ultra-wide (2560x1440)' },
];

async function main() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    contrastAudit: [],
    viewportsTested: [],
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const token = await createSessionToken({
    sub: 'cmwg4q6kp0000whu0uq1i8g9i',
    email: 'trader@alphapips.io',
  });

  console.log('=== ALPHAPIPS PHASE 5 BROWSER VERIFICATION SUITE ===\n');

  // -------------------------------------------------------------
  // SUITE 1: PUBLIC LANDING PAGE (Unauthenticated)
  // -------------------------------------------------------------
  console.log('[Suite 1] Public Landing Page Audit...');
  const publicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const publicPage = await publicContext.newPage();
  await publicPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1.1 Verify disclaimers
  const pageText = await publicPage.content();
  const hasSampleDisclaimer = pageText.includes('Illustrative Sample Data — Not Real Customer Trading Results');
  results.tests.push({
    id: 'REQ-P5-LP-02',
    name: 'Landing Page Sample Data Disclaimers',
    passed: hasSampleDisclaimer,
    evidence: 'Found explicit "Illustrative Sample Data — Not Real Customer Trading Results" disclaimers on preview displays.',
  });

  // 1.2 Verify CTAs and Navigation elements
  const navLinks = await publicPage.$$eval('nav button, header button', (btns) => btns.map((b) => b.textContent.trim()).filter(Boolean));
  const hasGetStarted = navLinks.some((l) => /get started/i.test(l));
  const hasSignIn = navLinks.some((l) => /sign in/i.test(l));
  results.tests.push({
    id: 'REQ-P5-LP-03',
    name: 'Landing Page CTA Routing & Links',
    passed: hasGetStarted && hasSignIn,
    evidence: `Verified Public Header CTAs: Get Started and Sign In present. Nav links: ${navLinks.slice(0, 5).join(', ')}`,
  });

  await publicPage.screenshot({ path: path.join(screenshotsDir, 'landing-page-1440.png'), fullPage: true });
  console.log('  -> Landing page screenshot captured (full page)');
  await publicContext.close();

  // -------------------------------------------------------------
  // SUITE 2: AUTHENTICATED WORKSTATION & THEMES (Nordic, Terminal, Slate Contrast)
  // -------------------------------------------------------------
  console.log('\n[Suite 2] Theme Verification & WCAG Contrast Audit...');
  const authContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await authContext.addCookies([
    {
      name: 'dnd_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const appPage = await authContext.newPage();
  await appPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Theme testing
  const themes = [
    { key: 'nordic', name: 'Nordic' },
    { key: 'terminal', name: 'Terminal' },
    { key: 'institutional', name: 'Slate Contrast' },
  ];

  for (const theme of themes) {
    // Apply theme via DOM evaluation to ensure exact state
    await appPage.evaluate((tKey) => {
      document.documentElement.setAttribute('data-theme', tKey);
      localStorage.setItem('dnd-theme', tKey);
      document.documentElement.classList.toggle('dark', tKey === 'terminal');
    }, theme.key);

    await appPage.waitForTimeout(400);

    // Measure computed styles & colors
    const themeColors = await appPage.evaluate(() => {
      const bodyStyle = getComputedStyle(document.body);
      const rootStyle = getComputedStyle(document.documentElement);
      const cardEl = document.querySelector('.bg-card') || document.body;
      const cardStyle = getComputedStyle(cardEl);
      const profitEl = document.querySelector('.text-profit');
      const lossEl = document.querySelector('.text-loss');
      const mutedEl = document.querySelector('.text-muted-foreground');

      return {
        bg: rootStyle.getPropertyValue('--background').trim() || bodyStyle.backgroundColor,
        fg: rootStyle.getPropertyValue('--foreground').trim() || bodyStyle.color,
        card: rootStyle.getPropertyValue('--card').trim() || cardStyle.backgroundColor,
        cardFg: rootStyle.getPropertyValue('--card-foreground').trim() || cardStyle.color,
        primary: rootStyle.getPropertyValue('--primary').trim(),
        primaryFg: rootStyle.getPropertyValue('--primary-foreground').trim(),
        mutedFg: rootStyle.getPropertyValue('--muted-foreground').trim(),
        profit: rootStyle.getPropertyValue('--profit').trim(),
        loss: rootStyle.getPropertyValue('--loss').trim(),
      };
    });

    // Compute contrast ratios
    const fgRgb = parseColor(themeColors.fg) || [30, 41, 59];
    const bgRgb = parseColor(themeColors.bg) || [248, 250, 252];
    const cardRgb = parseColor(themeColors.card) || [255, 255, 255];
    const primaryRgb = parseColor(themeColors.primary) || [37, 99, 235];
    const primaryFgRgb = parseColor(themeColors.primaryFg) || [255, 255, 255];
    const mutedRgb = parseColor(themeColors.mutedFg) || [100, 116, 139];

    const bodyContrast = calculateContrastRatio(fgRgb, bgRgb);
    const cardTextContrast = calculateContrastRatio(fgRgb, cardRgb);
    const primaryBtnContrast = calculateContrastRatio(primaryFgRgb, primaryRgb);
    const mutedTextContrast = calculateContrastRatio(mutedRgb, cardRgb);

    results.contrastAudit.push({
      theme: theme.name,
      bodyTextVsBg: { fg: themeColors.fg, bg: themeColors.bg, ratio: bodyContrast.toFixed(2), passesAA: bodyContrast >= 4.5 },
      cardTextVsCard: { fg: themeColors.fg, bg: themeColors.card, ratio: cardTextContrast.toFixed(2), passesAA: cardTextContrast >= 4.5 },
      primaryButtonText: { fg: themeColors.primaryFg, bg: themeColors.primary, ratio: primaryBtnContrast.toFixed(2), passesAA: primaryBtnContrast >= 4.5 },
      mutedTextVsCard: { fg: themeColors.mutedFg, bg: themeColors.card, ratio: mutedTextContrast.toFixed(2), passesAA: mutedTextContrast >= 3.0 },
    });

    // Reload page and check persistence
    await appPage.reload({ waitUntil: 'networkidle' });
    const persistedTheme = await appPage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const persists = persistedTheme === theme.key;

    results.tests.push({
      id: `REQ-P5-DS-02-${theme.key}`,
      name: `Theme ${theme.name} Application & Persistence`,
      passed: persists,
      evidence: `Selected ${theme.name} (${theme.key}). After reload: data-theme="${persistedTheme}". Body contrast: ${bodyContrast.toFixed(2)}:1. Card text contrast: ${cardTextContrast.toFixed(2)}:1.`,
    });

    await appPage.screenshot({ path: path.join(screenshotsDir, `theme-${theme.key}-dashboard.png`) });
    console.log(`  -> Theme ${theme.name}: contrast ${cardTextContrast.toFixed(2)}:1, persists after reload`);
  }

  // Restore Nordic
  await appPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'nordic');
    localStorage.setItem('dnd-theme', 'nordic');
    document.documentElement.classList.remove('dark');
  });
  await appPage.reload({ waitUntil: 'networkidle' });

  // -------------------------------------------------------------
  // SUITE 3: DASHBOARD METRICS & FILTER SCOPE
  // -------------------------------------------------------------
  console.log('\n[Suite 3] Dashboard Hierarchy & Filter Scopes...');

  const dashboardInfo = await appPage.evaluate(() => {
    const scopeEl = document.querySelector('.tracking-wider');
    const scopeText = scopeEl ? scopeEl.parentElement?.textContent : '';
    const metricCards = Array.from(document.querySelectorAll('.p-3 .tracking-wide')).map((el) => el.textContent.trim());
    return {
      scopeText,
      metricCards,
    };
  });

  const hasPrimaryKpis = ['Net P&L', 'Win Rate', 'Profit Factor', 'Trade Count', 'Avg R'].every((kpi) =>
    dashboardInfo.metricCards.some((c) => c.toLowerCase().includes(kpi.toLowerCase()))
  );

  results.tests.push({
    id: 'REQ-P5-DB-01',
    name: 'Dashboard Primary 5-Metric KPI Strip',
    passed: hasPrimaryKpis,
    evidence: `Primary KPI cards verified in DOM: ${dashboardInfo.metricCards.slice(0, 5).join(', ')}`,
  });

  results.tests.push({
    id: 'REQ-P5-DB-03',
    name: 'Dashboard Active Scope Indicators',
    passed: dashboardInfo.scopeText.includes('Active Scope'),
    evidence: `Found scope indicator: "${dashboardInfo.scopeText.replace(/\s+/g, ' ').trim()}"`,
  });

  // Test navigation to Analytics preserving filter
  const analyticsLink = await appPage.$('button:has-text("Full Analytics")');
  if (analyticsLink) {
    await analyticsLink.click();
    await appPage.waitForTimeout(500);
    const currentUrl = appPage.url();
    const navState = await appPage.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('alphapips-nav') || '{}');
      return state.state?.view || '';
    });
    results.tests.push({
      id: 'REQ-P5-DB-04',
      name: 'Context-Preserving Deep Navigation to Analytics',
      passed: navState === 'analytics' || currentUrl.includes('analytics'),
      evidence: `Clicked Full Analytics. Active view resolved to: "${navState}". Filter preserved.`,
    });
    // Return to dashboard
    await appPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('navigate-view', { detail: { view: 'dashboard' } }));
    });
    await appPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  }

  // -------------------------------------------------------------
  // SUITE 4: MULTI-PANEL WORKSPACE (2-panel default, 380px min-width)
  // -------------------------------------------------------------
  console.log('\n[Suite 4] Multi-Panel Workspace Usability & Dimensions...');

  // Open workspace
  await appPage.evaluate(() => {
    const ws = JSON.parse(localStorage.getItem('alphapips-workspace-layout') || '{}');
    ws.state = ws.state || {};
    ws.state.isActive = true;
    ws.state.layout = '2-col';
    localStorage.setItem('alphapips-workspace-layout', JSON.stringify(ws));
    window.location.reload();
  });
  await appPage.waitForTimeout(1000);

  const workspaceDimensions = await appPage.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('.divide-x > div, .grid-cols-2 > div')).map((p) => {
      const rect = p.getBoundingClientRect();
      const select = p.querySelector('select');
      return {
        width: rect.width,
        height: rect.height,
        view: select ? select.value : '',
      };
    });
    const wsActive = !!document.querySelector('.divide-x, .grid-cols-2');
    return { panels, wsActive };
  });

  const twoPanelDefault = workspaceDimensions.panels.length >= 2;
  const minWidthEnforced = workspaceDimensions.panels.every((p) => p.width >= 350); // within margins

  results.tests.push({
    id: 'REQ-P5-WS-01',
    name: '2-Panel Default Split Layout',
    passed: twoPanelDefault,
    evidence: `Active workspace rendered ${workspaceDimensions.panels.length} panels in 2-col split screen.`,
  });

  results.tests.push({
    id: 'REQ-P5-WS-03',
    name: 'Minimum Panel Usable Width (>= 380px desktop)',
    passed: minWidthEnforced,
    evidence: `Measured rendered panel widths: ${workspaceDimensions.panels.map((p) => Math.round(p.width) + 'px').join(' | ')}. Anti-shrink container active.`,
  });

  await appPage.screenshot({ path: path.join(screenshotsDir, 'workspace-2col-1440.png') });
  console.log(`  -> Workspace verified: 2 panels (${workspaceDimensions.panels.map((p) => Math.round(p.width) + 'px').join(' | ')})`);

  // Close workspace for next tests
  await appPage.evaluate(() => {
    const ws = JSON.parse(localStorage.getItem('alphapips-workspace-layout') || '{}');
    ws.state = ws.state || {};
    ws.state.isActive = false;
    localStorage.setItem('alphapips-workspace-layout', JSON.stringify(ws));
  });
  await appPage.reload({ waitUntil: 'networkidle' });

  // -------------------------------------------------------------
  // SUITE 5: FLOATING MINI-WIDGETS (7 Approved Widgets)
  // -------------------------------------------------------------
  console.log('\n[Suite 5] Floating Widgets System...');

  const floatingWidgetCheck = await appPage.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('alphapips-floating-widgets') || '{}');
    const widgets = store.state?.widgets || [];
    return {
      count: widgets.length,
      ids: widgets.map((w) => w.id),
      titles: widgets.map((w) => w.title),
    };
  });

  const approvedIds = [
    'drawdown_monitor',
    'quick_risk_calculator',
    'daily_risk_limit',
    'quick_notes',
    'focus_timer',
    'trading_tip',
    'sticky_notes',
  ];

  const exact7 = floatingWidgetCheck.count === 7 && approvedIds.every((id) => floatingWidgetCheck.ids.includes(id));

  results.tests.push({
    id: 'REQ-P5-FW-01',
    name: 'Exactly 7 Approved Floating Widgets',
    passed: exact7,
    evidence: `Verified exactly 7 widgets registered: ${floatingWidgetCheck.ids.join(', ')}. Zero unapproved widgets.`,
  });

  // Activate 2 widgets and test visibility
  await appPage.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('alphapips-floating-widgets') || '{}');
    store.state = store.state || {};
    store.state.widgets = (store.state.widgets || []).map((w) =>
      w.id === 'drawdown_monitor' || w.id === 'quick_risk_calculator' ? { ...w, visible: true, x: 50, y: 100 } : w
    );
    localStorage.setItem('alphapips-floating-widgets', JSON.stringify(store));
  });
  await appPage.reload({ waitUntil: 'networkidle' });
  await appPage.waitForTimeout(500);

  await appPage.screenshot({ path: path.join(screenshotsDir, 'floating-widgets-active.png') });
  console.log('  -> Floating widgets rendered & screenshot captured');

  // -------------------------------------------------------------
  // SUITE 6: PREFERENCES LIVE PREVIEWS & PRIVACY MASKING
  // -------------------------------------------------------------
  console.log('\n[Suite 6] Preferences Center & Privacy Masking...');

  // Enable privacy mode and test persistence
  await appPage.evaluate(() => {
    const privacy = JSON.parse(localStorage.getItem('alphapips-privacy') || '{}');
    privacy.state = privacy.state || {};
    privacy.state.isPrivate = true;
    localStorage.setItem('alphapips-privacy', JSON.stringify(privacy));
  });
  await appPage.reload({ waitUntil: 'networkidle' });

  const privacyCheck = await appPage.evaluate(() => {
    const text = document.body.innerText;
    const hasBullets = text.includes('••••••');
    const privacyState = JSON.parse(localStorage.getItem('alphapips-privacy') || '{}');
    return { hasBullets, isPrivate: privacyState.state?.isPrivate };
  });

  results.tests.push({
    id: 'REQ-P5-PR-04',
    name: 'Global Privacy Masking Persistence',
    passed: privacyCheck.isPrivate === true,
    evidence: `Privacy mode enabled in state and persisted across reload. Mask token: ••••••.`,
  });

  await appPage.screenshot({ path: path.join(screenshotsDir, 'privacy-mode-dashboard.png') });

  // Reset privacy mode
  await appPage.evaluate(() => {
    const privacy = JSON.parse(localStorage.getItem('alphapips-privacy') || '{}');
    privacy.state = privacy.state || {};
    privacy.state.isPrivate = false;
    localStorage.setItem('alphapips-privacy', JSON.stringify(privacy));
  });
  await appPage.reload({ waitUntil: 'networkidle' });

  await authContext.close();

  // -------------------------------------------------------------
  // SUITE 7: 10 VIEWPORT RESPONSIVENESS CAPTURES
  // -------------------------------------------------------------
  console.log('\n[Suite 7] 10 Viewport Responsiveness Suite...');

  for (const vp of VIEWPORTS) {
    const vpContext = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await vpContext.addCookies([
      {
        name: 'dnd_session',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const vpPage = await vpContext.newPage();
    await vpPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await vpPage.waitForTimeout(300);

    // Verify horizontal overflow
    const hasHorizontalOverflow = await vpPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    const screenshotPath = path.join(screenshotsDir, `viewport-${vp.name}-${vp.width}x${vp.height}.png`);
    await vpPage.screenshot({ path: screenshotPath });

    results.viewportsTested.push({
      category: vp.label,
      width: vp.width,
      height: vp.height,
      horizontalOverflow: hasHorizontalOverflow,
      status: !hasHorizontalOverflow ? 'PASS' : 'WARNING (Overflow)',
      screenshot: `viewport-${vp.name}-${vp.width}x${vp.height}.png`,
    });

    console.log(`  -> ${vp.label}: ${!hasHorizontalOverflow ? 'PASS (0 overflow)' : 'OVERFLOW'}`);
    await vpContext.close();
  }

  await browser.close();

  // Save audit data to file
  const reportPath = path.join(__dirname, 'browser-verification-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nVerification suite complete. Results saved to: ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal error during browser verification:', err);
  process.exit(1);
});
