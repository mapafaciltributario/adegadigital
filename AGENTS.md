<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Checkout
- Payments go through Cakto: Pix via `POST /public_api/payments/` from server functions, card via Cakto hosted checkout; see docs/CHECKOUT.md. Why: card tokenization SDK not adopted, credentials must stay server-side.
- Payment approval is read from Cakto order status (`paid` only), never from URLs or client state. Why: prevents fake confirmations.

## Motion
- Keep presentation motion scoped to `.motion-page` in the shared stylesheet and honor reduced-motion preferences; this keeps checkout and sales interactions consistent without changing payment logic.

## Tracking
- All marketing events go through `src/lib/tracking/` (browser) and `src/lib/meta-capi.server.ts` (server); pages call `track()` only. Why: one place owns event ids, consent and dedup.
- Purchase is sent only after Cakto reports `paid` (re-checked server-side in `sendPurchaseEvent`), at Cakto's amount, from the approved screen once per tab, Pixel and CAPI with the same `purchase_{orderId}` id. Why: no fake purchases; repeats are deduplicated by Meta via the stable id.
- Pixels load at idle time and run by default; a visitor who refuses in the footer "Privacidade e cookies" loads and sends nothing. Why: no floating banner on the sales page, opt-out instead of opt-in.
- No database: Cakto is the only source of order status; the webhook only verifies and re-checks, with no side effects. Why: owner chose a stateless Vercel-friendly setup; add a store (e.g. Upstash Redis via Vercel Marketplace) only if a server-only Purchase from the webhook becomes necessary.
- UTMs, src/sck and fbclid are captured on the first page into session storage (`src/lib/tracking/attribution.ts`) and read from there by checkout and fbc creation. Why: attribution survives navigation and late consent.
- Visitor IP comes from `src/lib/request-ip.ts`, which reads Cloudflare and Vercel proxy headers. Why: the app must run on either host.
- Fonts are self-hosted via @fontsource (latin subsets only). Why: no render-blocking third-party font requests.
