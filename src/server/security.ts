import { timingSafeEqual } from "node:crypto";
export function authorised(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  )
    return false;
  const origin = request.headers.get("origin");
  // Next may normalise request.url to localhost; the validated Host is the
  // browser-facing authority. Never trust X-Forwarded-Host here.
  if (origin && origin !== `${url.protocol}//${host}`) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const key = process.env.APP_ACCESS_KEY;
  if (!key) return false;
  const supplied = request.headers.get("x-app-key") ?? "";
  const a = Buffer.from(supplied),
    b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
