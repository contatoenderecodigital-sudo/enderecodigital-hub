import { NextResponse } from "next/server";
import { HUB_COOKIE } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/owner", req.url));
  res.cookies.set(HUB_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
