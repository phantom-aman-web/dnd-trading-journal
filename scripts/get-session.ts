import { db } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

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
