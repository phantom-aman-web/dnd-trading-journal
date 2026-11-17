import { db } from "./src/lib/db.js";
import { createSessionToken } from "./src/lib/auth.js";

async function main() {
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({
      data: {
        email: "trader@alphapips.com",
        name: "Pro Trader",
        passwordHash: "dummy",
      },
    });
  }
  const token = await createSessionToken({ sub: user.id, email: user.email });
  console.log(JSON.stringify({ token, user }));
}

main().catch(console.error);
