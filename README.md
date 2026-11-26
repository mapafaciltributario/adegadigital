# Swift Pixel Checkout Compass

MISSÃO — OTIMIZAÇÃO MÁXIMA DE PERFORMANCE, RASTREAMENTO E CONVERSÃO



Atue como um engenheiro de software sênior especializado em performance web, Meta Pixel, API de Conversões, rastreamento de campanhas, checkout transparente e otimização de conversão.



Sua missão é aprimorar o projeto fornecido, mantendo uma arquitetura simples, leve, eficiente e totalmente compatível com a Vercel.



1. OBJETIVO PRINCIPAL



Construir uma operação tecnicamente eficiente para tráfego pago, buscando:



- Menor desperdício de investimento publicitário.

- Maior aproveitamento dos visitantes.

- Carregamento extremamente rápido.

- Rastreamento confiável das conversões.

- Menor abandono de checkout.

- Melhor qualidade dos sinais enviados ao algoritmo da Meta.



O objetivo comercial é favorecer um CPM competitivo, CPC baixo, CTR saudável e CPA reduzido, reconhecendo que essas métricas também dependem dos criativos, do público e do leilão da Meta.



Não prometa controlar diretamente métricas publicitárias pelo código do site.



2. PERFORMANCE DA PÁGINA



Otimize agressivamente a velocidade sem prejudicar o design existente.



- Reduza JavaScript desnecessário.

- Comprima e otimize imagens.

- Priorize o conteúdo acima da dobra.

- Implemente lazy loading quando apropriado.

- Reduza requisições externas.

- Otimize fontes e recursos críticos.

- Evite bloqueios de renderização.

- Priorize dispositivos móveis e conexões lentas.

- Preserve a estabilidade visual.

- Carregue scripts de rastreamento de maneira eficiente, respeitando o consentimento aplicável.



Busque as seguintes metas de Core Web Vitals:



- LCP: até 2,5 segundos.

- INP: até 200 milissegundos.

- CLS: até 0,1.



Meça os resultados quando possível, sem inventar pontuações.



3. RASTREAMENTO META PIXEL E CAPI



Implemente uma estrutura centralizada e confiável de rastreamento.



Eventos:



- PageView.

- ViewContent.

- InitiateCheckout.

- AddPaymentInfo.

- Purchase.



Utilize Pixel e API de Conversões de maneira coordenada, com event_id consistente para deduplicação.



Capture e preserve, quando permitido:



- UTMs.

- fbclid.

- fbp.

- fbc.

- Event source URL.

- Identificadores de pedido.

- Valor real da compra.

- Moeda BRL.



Utilize dados de correspondência permitidos pela Meta, com tratamento adequado e respeito à LGPD.



Nunca invente eventos, compras, valores ou dados de clientes.



O evento Purchase deverá ocorrer exclusivamente após confirmação legítima do pagamento.



4. INTEGRAÇÃO LOWTRACK



Utilize o script oficial disponibilizado pelo painel do LowTrack.



Preserve corretamente o identificador do pixel e os parâmetros de atribuição.



Evite duplicação de eventos entre LowTrack, Meta Pixel, CAPI e plataforma de pagamento.



Não invente endpoints nem utilize integrações não documentadas.



5. CHECKOUT E CONFIRMAÇÃO



Preserve as integrações legítimas existentes com a Cakto.



Mantenha a confirmação de pagamento exclusivamente no servidor.



Após a confirmação legítima do pagamento, apresente uma tela profissional contendo:



- Animação de confirmação.

- Mensagem “PAGAMENTO APROVADO!”.

- Orientações de acesso.

- Botão “ACESSAR ÁREA DE MEMBROS”.

- Redirecionamento para o endereço oficial da área de membros da Cakto.



Utilize a variável APP_ACCESS_URL para configurar o endereço.



Nunca libere acesso com base exclusivamente em parâmetros da URL ou informações fornecidas pelo navegador.



6. ARQUITETURA SIMPLES



A operação deve permanecer leve, econômica e fácil de manter.



- Priorize compatibilidade com a Vercel.

- Evite dependências desnecessárias.

- Não introduza Supabase, Cloudflare, bancos externos ou novos serviços sem necessidade técnica comprovada.

- Utilize mecanismos confiáveis de confirmação e idempotência.

- Caso algum recurso exija armazenamento persistente, explique a necessidade antes de adicionar uma nova infraestrutura.

- Nunca utilize memória temporária como garantia permanente contra duplicações.

- Mantenha credenciais sensíveis exclusivamente no servidor.



7. ENVIRONMENT VARIABLES



Analise todas as variáveis realmente utilizadas pelo código.



Reaproveite as existentes sempre que possível.



Crie novas variáveis somente quando necessárias.



Ao finalizar, apresente uma tabela contendo:



- Nome exato da variável.

- Tipo: Secret ou Config.

- Origem do valor.

- Finalidade.

- Obrigatória ou opcional.

- Ambiente recomendado.



Atualize o arquivo .env.example sem incluir credenciais reais.



8. PRESERVAÇÃO DO PROJETO



Não altere desnecessariamente:



- Design.

- Identidade visual.

- Preços.

- Ofertas.

- Textos comerciais.

- Produtos.

- Estrutura visual do checkout.



O foco é aprimoramento técnico, velocidade, confiabilidade e experiência do usuário.



9. VALIDAÇÃO FINAL



Execute os testes disponíveis e verifique:



- Build compatível com a Vercel.

- Ausência de erros no console.

- Funcionamento das rotas.

- Preservação de UTMs.

- Segurança das credenciais.

- Deduplicação de eventos.

- Confirmação de pagamentos.

- Tela de pagamento aprovado.

- Acesso à área de membros.

- Desempenho em dispositivos móveis.



Diferencie claramente o que foi implementado, o que foi testado e o que ainda depende de credenciais ou testes em produção.



Não declare uma integração funcional sem evidências.



O resultado final deve ser uma operação enxuta, rápida, confiável e tecnicamente preparada para receber tráfego pago, sem complexidade empresarial desnecessária.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://swift-pixel-checkout-compass.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6531626d-df90-456a-8a06-c29be25047ac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
