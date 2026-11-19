import { getSessionUser } from "@/lib/auth";
import { ClientHome } from "@/components/client-home";
import type { AuthUser } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialUser: AuthUser | null = null;
  try {
    const session = await getSessionUser();
    if (session) {
      initialUser = {
        id: session.id,
        email: session.email,
        name: session.name,
      };
    }
  } catch {
    initialUser = null;
  }

  return <ClientHome initialUser={initialUser} />;
}
