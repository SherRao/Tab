import { getSessionUser } from "@/lib/auth";
import { searchAccounts } from "@/lib/participants";

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const accounts = q.trim().length >= 2 ? await searchAccounts(q) : [];
  return Response.json({ accounts });
}
