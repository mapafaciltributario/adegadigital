/** Visitor IP from proxy headers. Works on Vercel (x-real-ip / x-vercel-forwarded-for) and Cloudflare. */
export function clientIp(get: (name: string) => string | undefined): string | undefined {
  for (const h of ["cf-connecting-ip", "x-real-ip", "x-vercel-forwarded-for", "x-forwarded-for"]) {
    const v = get(h)?.split(",")[0]?.trim();
    if (v && v.length <= 64 && /^[0-9a-fA-F.:]+$/.test(v)) return v;
  }
  return undefined;
}
