import { NextResponse } from "next/server";
import { HUB_COOKIE } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = new NextResponse(null, { status: 303, headers: { Location: "/owner" } });
  res.cookies.set(HUB_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
