import { createSessionToken } from "../src/lib/auth";
import fs from "fs";
import path from "path";

// Find user with data
const TEST_USER_ID = "cmu2zfyv20000l504ia6dj90k"; // Wiwo (19 trades, 1 account)
const TEST_EMAIL = "bijisterbosch@gmail.com";

interface CDPResponse {
  id: number;
  result?: any;
  error?: any;
}

export class SimpleCDP {
  private ws: WebSocket;
  private messageId = 0;
  private pending = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const data: CDPResponse = JSON.parse(event.data.toString());
          if (data.id && this.pending.has(data.id)) {
            const cb = this.pending.get(data.id)!;
            this.pending.delete(data.id);
            if (data.error) {
              console.error("CDP Error:", data.error);
            }
            cb(data.result);
          }
        } catch (e) {
          console.error("Error parsing CDP message:", e);
        }
      };
    });
  }

  send(method: string, params: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve) => {
      const id = ++this.messageId;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  const screenshotDir = path.join(process.cwd(), "verification-screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const token = await createSessionToken({ sub: TEST_USER_ID, email: TEST_EMAIL });
  console.log("Generated test session token for", TEST_EMAIL);

  // Get or create new target tab
  const newTabRes = await fetch("http://localhost:9222/json/new?http://localhost:3000", { method: "PUT" });
  const tabData = await newTabRes.json();
  const wsUrl = tabData.webSocketDebuggerUrl;
  console.log("Connected to tab:", tabData.id, wsUrl);

  const cdp = new SimpleCDP(wsUrl);
  await cdp.connect();

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  // Set auth cookie
  await cdp.send("Network.setCookie", {
    name: "dnd_session",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
  });

  // Navigate to app
  await cdp.send("Page.navigate", { url: "http://localhost:3000" });
  await new Promise((r) => setTimeout(r, 3000));

  // Set viewport to 1440x900
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Take screenshot of Dashboard
  const dashSnap = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(screenshotDir, "01-dashboard-nordic-1440.png"), Buffer.from(dashSnap.data, "base64"));
  console.log("Saved: 01-dashboard-nordic-1440.png");

  cdp.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
