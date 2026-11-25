# Checkout Cakto

Fonte: https://docs.cakto.com.br (consultada em 25/11/2026).

## Fluxo
- **Pix (transparente):** `/checkout` → server fn `createPixCharge` → `POST /public_api/payments/` (`paymentMethod: "pix"`, header `X-Idempotency-Key`). QR Code gerado no navegador a partir de `pix.qrCode`. A tela consulta `GET /public_api/orders/{id}/` a cada 5 s; só `status = paid` é aprovado.
- **Cartão (hospedado):** redireciona para `https://pay.cakto.com.br/{offerId}`. Os dados do cartão nunca passam por este site.
- **Confirmação:** `/confirmacao?pedido={id}` sempre consulta o status na Cakto; chegar na página não aprova nada.

## Endpoints Cakto usados
| Endpoint | Uso | Escopo |
|---|---|---|
| `POST /public_api/token/` | OAuth2 client_credentials (token reutilizado até expirar) | — |
| `GET /public_api/offers/{id}/` | Confere oferta ativa e preço antes de cobrar | read offers |
| `POST /public_api/payments/` | Cria cobrança Pix | write payments |
| `GET /public_api/orders/{id}/` | Status do pedido (tela e webhook) | read orders |

## Webhook
`POST /api/public/cakto-webhook`. Valida `X-Cakto-Signature` = `v1=HMAC-SHA256(secret, "{X-Cakto-Timestamp}.{corpo cru}")`, tolerância 5 min. Aceita `data` objeto ou lista (Webhook V2). Deduplica por `evento:data.id`, reconsulta o pedido em `purchase_approved` e registra apenas id/status. A entrega do produto é feita pela própria Cakto (e-mail/área de membros) após a aprovação.

## Proteções
- Preço validado no servidor contra a oferta na Cakto. Credenciais só no servidor.
- Idempotência: mesma chave para o mesmo pedido/dados (Cakto devolve a mesma cobrança por 24 h); botão travado durante o envio.
- Nenhum dado de cartão/CVV armazenado. Logs sem dados pessoais.

## Configuração
1. Cakto → Integrações → Cakto API → criar chave com escopos `read write offers orders payments`.
2. Criar/conferir as 3 ofertas com os preços R$ 24,90 / 17,90 / 10,00.
3. Salvar os valores do `.env.example` em Secrets.
4. Publicar o site e criar o webhook na Cakto com a URL `https://SEU-DOMINIO/api/public/cakto-webhook` (eventos: purchase_approved, purchase_refused, pix_gerado, refund, chargeback). Salvar o secret gerado em `CAKTO_WEBHOOK_SECRET`.

## Depende de permissões/condições da Cakto
- `payments`: conta com abertura concluída, ativa, principal e fora de encerramento (a API não informa isso antes de cobrar).
- Cartão transparente: exige escopo `card_tokens` + SDK de tokenização (+3DS) — não implementado; usa checkout hospedado.
- Boleto: removido da API em 11/09/2026.
- Ambiente de testes (staging): precisa ser solicitado à Cakto.

## Testes
`bunx vitest run src/test/checkout.test.ts` — preços, validação de CPF/CNPJ/celular, mapeamento de status e assinatura do webhook.

## Order bumps
Four optional add-ons on every plan (see `BUMPS` in `src/lib/checkout-core.ts`). Selecting all four applies the combo price (R$ 16,64) via `CAKTO_BUMP_COMBO`. Each bump offer is price-checked server-side and sent as `offerType: "orderbump"`. Bumps are included only in Pix charges; the card flow uses Cakto's hosted checkout, where bumps must be configured inside Cakto.
