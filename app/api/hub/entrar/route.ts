import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHub } from "@/lib/data";
import { HUB_COOKIE } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

// Location RELATIVO (atrás do proxy Coolify, req.url é o host interno 0.0.0.0:3000).
function irPara(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") return irPara("/login");

  const id = new URL(req.url).searchParams.get("id") || "";
  const hub = id ? await getHub(id) : null;
  if (!hub) return irPara("/owner");

  const res = irPara("/owner");
  res.cookies.set(HUB_COOKIE, hub.id, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
