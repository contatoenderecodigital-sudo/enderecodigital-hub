import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHub } from "@/lib/data";
import { HUB_COOKIE } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma")
    return NextResponse.redirect(new URL("/login", req.url));

  const id = new URL(req.url).searchParams.get("id") || "";
  const hub = id ? await getHub(id) : null;
  if (!hub) return NextResponse.redirect(new URL("/owner", req.url));

  const res = NextResponse.redirect(new URL("/owner", req.url));
  res.cookies.set(HUB_COOKIE, hub.id, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
