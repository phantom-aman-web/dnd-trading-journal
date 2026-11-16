const { chromium } = require('C:/Users/hp/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const { createSessionToken } = require('../src/lib/auth');

async function run() {
  const token = await createSessionToken({
    sub: "cmwg4q6kp0000whu0uq1i8g9i",
    email: "trader@alphapips.io",
  });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'dnd_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  console.log('Page title:', await page.title());
  console.log('Current URL:', page.url());

  // Capture screenshot of authenticated app
  await page.screenshot({ path: 'phase5-evidence/screenshots/authenticated-dashboard-1440.png' });
  console.log('Saved authenticated screenshot');

  await browser.close();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
