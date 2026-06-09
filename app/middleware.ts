import { NextResponse } from "next/server";

export const config = {
  matcher: "/__streampump_noop_middleware__/:path*",
};

export function middleware() {
  return NextResponse.next();
}
