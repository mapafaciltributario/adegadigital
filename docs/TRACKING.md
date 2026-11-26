# Rastreamento

Toda medição passa por `src/lib/tracking/` (navegador) e `src/lib/meta-capi.server.ts` (servidor).
Scripts carregam em tempo ocioso, `async`. A medição roda por padrão; quem recusa em "Privacidade e
cookies" (rodapé) não carrega script algum nem envia evento algum, nem dados de correspondência.

## Quem envia cada evento
| Evento | Quando | Pixel (navegador) | API de Conversões (servidor) |
|---|---|---|---|
| PageView | cada troca de página | este app | este app (mesmo event_id) |
| ViewContent | abrir a página de vendas (1x por sessão) | este app | este app |
| InitiateCheckout | abrir o checkout (1x por plano/sessão) | este app | este app |
| AddPaymentInfo | Pix gerado ou ida ao cartão | este app | este app |
| Purchase (Pix) | **só** quando a Cakto responde `status = paid` | tela de aprovado, com `purchase_{pedido}` | tela de aprovado → servidor reconsulta a Cakto e envia com o mesmo `purchase_{pedido}`; a Meta deduplica repetições |
| Purchase (cartão) | checkout hospedado da Cakto | **integração de Pixel da própria Cakto** | idem |
| LowTrack | — | só o script do painel | — |

Para não duplicar: **desligue no LowTrack o envio de eventos para a Meta** (este app já envia),
e configure o Pixel na Cakto apenas para as vendas do checkout hospedado (cartão), ou aceite que a Meta deduplica só quando o event_id é igual.

Valores: vêm da tabela de preços do servidor ou do valor gravado no pedido da Cakto. Moeda BRL.
Dados pessoais: e-mail/celular só como SHA-256 e só com a medição permitida. Logs registram apenas evento e status HTTP.
Retentativas: 3 tentativas (429/5xx/rede); Purchase até 5 tentativas no total por pedido.
Testes: preencha `META_TEST_EVENT_CODE` para os eventos irem para "Eventos de teste" em vez de produção.

## Sem banco de dados
O status vem sempre da Cakto. O webhook só valida e reconsulta o pedido (sem efeitos, então reenvios da Cakto são inofensivos).
Limite conhecido: se o comprador pagar o Pix e nunca voltar à tela (nem ao checkout), o Purchase do servidor não é enviado.
Se isso virar problema, a alternativa mais simples na Vercel é um Redis gerenciado (Upstash, pelo Marketplace da Vercel) para o webhook enviar o Purchase com os dados de correspondência.
