import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions } from "@/lib/session";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
}
