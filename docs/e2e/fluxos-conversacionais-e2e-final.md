# Fluxos Conversacionais E2E Finais

## Objetivo

Este documento consolida os cenarios E2E finais para validar a jornada conversacional do AtendeAi de ponta a ponta:

- entrada do usuario;
- resposta inicial da IA;
- descoberta de contexto;
- horario, endereco e funcionamento;
- catalogo e carrinho;
- checkout e cobranca;
- confirmacao de pagamento;
- agendamento completo;
- recovery;
- leitura de PDF;
- promocoes e cupons.

O foco aqui e validar o comportamento real do produto, nao apenas endpoints isolados.

---

## Escopo principal

Os testes devem cobrir estes modulos e integracoes:

- `messaging`
- `ai`
- `catalog`
- `commerce`
- `sales`
- `payment`
- `scheduling`
- `recovery`
- `tenant`
- `contact`

Sempre que possivel, o fluxo deve validar:

1. mensagem inbound do usuario
2. resposta outbound da IA
3. persistencia da conversa
4. atualizacao de contexto/estado
5. efeito de negocio no modulo correto
6. mensagem final coerente no chat

---

## Pre-condicoes recomendadas

Antes de rodar a suite final, preparar um tenant E2E com:

- horario de funcionamento configurado
- endereco completo configurado
- profissionais cadastrados
- especialidades cadastradas
- categorias/servicos de agenda cadastrados
- catalogo com produtos
- pelo menos 1 promocao ativa
- pelo menos 1 cupom ativo
- meios de pagamento configurados
- webhook de pagamento funcional ou simulavel
- pelo menos 1 arquivo PDF de referencia enviado para o tenant

Dados minimos sugeridos:

- produto 1: `Cafe 500g`
- produto 2: `Bolo de cenoura`
- servico 1: `Avaliacao`
- profissional 1: `Dra Ana`
- profissional 2: `Dr Bruno`
- cupom: `BEMVINDO10`
- promocao: `Frete gratis acima de R$ 100`

---

## Cenário 1: Saudacao inicial

### Conversa

Usuario:
`olá`

IA:
`welcome message`

### Validacoes

- cria ou reutiliza conversa ativa
- identifica contato corretamente
- salva mensagem inbound
- salva resposta outbound
- usa o tom/base prompt do tenant
- nao envia resposta vazia
- nao gera cobranca, pedido ou agendamento indevido

---

## Cenário 2: Horario de funcionamento

### Conversa

Usuario:
`qual o horario de funcionamento?`

### Esperado

- IA informa horario correto da empresa
- respeita dia util, sabado, domingo e feriado se configurado
- nao inventa horario fora da configuracao do tenant

### Variantes

- `vocês abrem hoje?`
- `que horas fecha hoje?`
- `abrem no sábado?`
- `funcionam agora?`

### Casos negativos

- tenant sem horario configurado
- horario parcial por filial
- horario fora do expediente atual

---

## Cenário 3: Endereco

### Conversa

Usuario:
`qual o endereço de vocês?`

### Esperado

- IA informa endereco do tenant ou da filial correta
- se houver bairro/cidade/CEP configurado, usa os dados certos
- se houver multiplas filiais, pede clarificacao quando necessario

### Variantes

- `onde vocês ficam?`
- `me passa o endereço`
- `tem unidade no centro?`

---

## Cenário 4: Mostrar promocoes

### Conversa

Usuario:
`quais promoções vocês têm hoje?`

### Esperado

- IA lista promocoes ativas
- nao mostra promocao inativa ou expirada
- usa descricao e validade corretas

### Variantes

- `tem alguma oferta hoje?`
- `quais descontos estão rolando?`

---

## Cenário 5: Mostrar produtos

### Conversa

Usuario:
`quais produtos vocês têm?`

### Esperado

- IA mostra produtos do catalogo
- usa nome e preco corretos
- nao mistura servicos com produtos se o contexto for de venda de itens
- se houver categoria, pode agrupar corretamente

### Variantes

- `me mostra o catálogo`
- `o que vocês vendem?`
- `tem café?`

---

## Cenário 6: Intencao completa de comprar itens

### Conversa

Usuario:
`quero comprar 2 cafés e 1 bolo`

### Esperado

- IA entende a intencao de compra
- identifica os itens corretos
- monta carrinho
- calcula subtotal
- confirma quantidades
- avanca o contexto de checkout

### Validacoes tecnicas

- sessao de commerce criada ou atualizada
- itens persistidos no carrinho
- totais coerentes
- conversa continua no passo correto

### Variantes

- item inexistente
- item com nome ambíguo
- quantidade invalida
- estoque insuficiente

---

## Cenário 7: Mostrar carrinho

### Conversa

Usuario:
`me mostra meu carrinho`

### Esperado

- IA lista itens atuais
- mostra quantidades
- mostra subtotal e total
- informa se falta endereco/frete/pagamento

### Variantes

- carrinho vazio
- carrinho com 1 item
- carrinho com varios itens

---

## Cenário 8: Cupom antes de finalizar pedido

### Conversa

Usuario:
`tenho um cupom de desconto`

ou

Usuario:
`quero usar o cupom BEMVINDO10`

### Esperado

- IA reconhece o momento correto de aplicar cupom
- valida cupom ativo
- recalcula total
- explica desconto aplicado

### Casos negativos

- cupom inexistente
- cupom expirado
- cupom nao elegivel para os itens do carrinho
- pedido abaixo do minimo

---

## Cenário 9: Enviar cobranca

### Conversa

Usuario:
`pode finalizar`

### Esperado

- IA conclui checkout
- gera cobranca ou link de pagamento
- envia o link na conversa
- persiste `paymentLinkId` / `paymentReference` no contexto correto

### Validacoes

- mensagem com link enviada no chat
- cobranca criada no modulo de vendas/pagamento
- valor final confere com carrinho + desconto + frete

### Variantes

- PIX
- boleto
- cartao
- link de pagamento manual

---

## Cenário 10: Ver se cobranca foi paga

### Fluxo

1. usuario recebe link
2. pagamento e confirmado via webhook
3. sistema atualiza status

### Esperado

- status muda para pago
- contexto de checkout/sale reflete confirmacao
- evento objetivo de pagamento fica persistido

### Regra de negocio

- se for `checkout/new sale`, pagamento confirmado pode concluir a venda
- se for `recovery`, pagamento confirmado conta como `receita recuperada`, nao `nova venda`

---

## Cenário 11: Mostrar mensagem apos pagamento

### Gatilho

Webhook de pagamento confirmado

### Esperado

- conversa recebe mensagem automatica de confirmacao
- texto e coerente com o modulo:
  - `checkout`: confirma compra/pedido
  - `proposal`: confirma pagamento da proposta
  - `recovery`: confirma pagamento recuperado

### Validacoes

- mensagem outbound do sistema registrada
- sem duplicidade em webhook repetido
- status comercial atualizado corretamente

---

## Cenário 12: Agendar horario do inicio ao fim

### Conversa

Usuario:
`quero agendar uma avaliação`

### Esperado

- IA identifica servico/categoria
- mostra profissionais quando necessario
- mostra horarios disponiveis
- recebe escolha do usuario
- confirma reserva
- se houver pagamento antecipado, gera link
- apos pagamento, confirma agendamento na conversa

### Variantes

- agendamento sem pagamento
- agendamento com pagamento
- horario indisponivel
- disputa de slot

---

## Cenário 13: Mostrar lista de profissionais

### Conversa

Usuario:
`quais profissionais vocês têm?`

### Esperado

- IA lista profissionais ativos
- relaciona com especialidades quando existir
- nao mostra profissionais inativos

---

## Cenário 14: Mostrar horarios de um profissional

### Conversa

Usuario:
`quais horários a Dra Ana tem?`

### Esperado

- IA mostra apenas slots disponiveis
- respeita agenda real
- nao oferece horario reservado, bloqueado ou expirado

### Variantes

- profissional sem agenda
- profissional inexistente
- data especifica

---

## Cenário 15: Mostrar especialidades

### Conversa

Usuario:
`quais especialidades vocês atendem?`

### Esperado

- IA mostra especialidades corretas
- se houver profissionais vinculados, usa essa relacao
- pode sugerir encaminhamento para especialidade adequada

---

## Cenário 16: Ler dados de PDF uploadado

### Conversa

Usuario:
`analise o pdf que eu enviei`

ou

Usuario:
`o que tem nesse contrato/arquivo?`

### Esperado

- sistema acessa o arquivo PDF associado
- IA resume conteudo relevante
- extrai dados uteis quando suportado
- nao inventa informacoes que nao estao no documento

### Variantes

- PDF legivel com texto
- PDF escaneado/imagem
- PDF vazio
- PDF invalido
- PDF muito grande

### Casos de uso

- contrato
- laudo
- cardapio/catalogo
- tabela de precos

---

## Cenário 17: Proposta comercial com aceite e pagamento

### Fluxo

1. proposta enviada na conversa
2. cliente abre contrato publico
3. cliente aceita
4. sistema gera link de pagamento
5. webhook confirma pagamento
6. conversa recebe confirmacao final

### Esperado

- proposta enviada com link publico
- aceite persiste no backend
- pagamento vinculado a proposta
- conversa recebe confirmacao automatica
- venda conclui apenas quando houver prova objetiva esperada

---

## Cenário 18: Recovery com pagamento

### Fluxo

1. caso de recovery aberto
2. mensagem enviada ao cliente
3. link de cobranca enviado
4. webhook confirma pagamento
5. conversa recebe confirmacao

### Esperado

- status do caso vai para `PAID`
- UI mostra `Receita recuperada`
- nao contabiliza como nova venda

---

## Cenário 19: Funcionamento + endereco no mesmo fluxo

### Conversa

Usuario:
`que horas vocês abrem e onde ficam?`

### Esperado

- IA responde as duas perguntas no mesmo turno
- usa horario e endereco corretos
- nao ignora metade da intencao

---

## Cenário 20: Promocao + cupom antes do fechamento

### Conversa

Usuario:
`tem promoção? e posso usar cupom antes de fechar?`

### Esperado

- IA explica promocoes ativas
- informa como o cupom entra no fluxo
- nao aplica desconto sem validar regras

---

## Matriz de cenarios possiveis

### Intencao simples

- saudacao
- horario
- endereco
- catalogo
- promocoes
- especialidades
- profissionais

### Intencao transacional

- adicionar item ao carrinho
- remover item do carrinho
- alterar quantidade
- ver carrinho
- aplicar cupom
- fechar pedido
- gerar cobranca
- confirmar pagamento

### Intencao de servico/agenda

- ver profissionais
- ver especialidades
- ver horarios
- reservar slot
- pagar e confirmar

### Intencao documental

- ler PDF
- resumir PDF
- extrair dado de PDF

### Intencao comercial avancada

- proposta
- aceite
- pagamento
- webhook
- confirmacao final no chat

### Intencao financeira

- cobranca comercial
- recovery
- verificar pagamento
- idempotencia de webhook

---

## Casos negativos obrigatorios

- usuario sem contexto suficiente
- item inexistente
- profissional inexistente
- slot indisponivel
- pagamento falhado
- webhook duplicado
- webhook fora de ordem
- cupom invalido
- promocao expirada
- PDF corrompido
- tenant sem horario
- tenant sem endereco
- tenant sem catalogo
- tenant sem profissionais
- tenant sem meios de pagamento

---

## Casos de regressao obrigatorios

- saudacao nao deve quebrar fluxos transacionais
- horario/endereco nao devem criar checkout
- consulta de catalogo nao deve reservar agenda
- recovery pago nao deve virar nova venda
- proposta enviada sem aceite nao deve concluir venda
- pagamento confirmado deve sempre refletir na conversa
- mensagem final nao pode ser enviada duas vezes para o mesmo webhook

---

## Criterios de aceite final da suite

- todos os fluxos principais respondem com mensagens coerentes
- todos os efeitos de negocio relevantes ficam persistidos
- webhook altera estados corretamente
- conversa sempre reflete o estado final objetivo
- `nova venda` e `receita recuperada` ficam separadas
- proposta, checkout, scheduling e recovery mantem comportamento consistente

---

## Fonte unica de contexto comercial

Para evitar leituras diferentes entre `messaging`, `proposals`, `sales`, `recovery` e
`dashboard`, os testes finais tambem devem validar a existencia de uma leitura comercial
compartilhada no front.

Essa fonte unica precisa garantir:

- `NEW_SALE` mostra `nova venda`
- `RECOVERY` mostra `receita recuperada`
- `PAYMENT_CONFIRMED` e tratado como evidencia objetiva
- a mesma classificacao aparece de forma consistente em:
  - conversa
  - proposta
  - cobranca/link
  - recovery
  - dashboard

### Regras de validacao visual

- uma cobranca de `recovery` paga nunca pode aparecer como `nova venda`
- uma proposta paga nunca pode aparecer como `receita recuperada`
- um link comercial manual nao pode ser promovido a `nova venda` sem o evento correto
- o webhook precisa refletir a mesma classificacao no chat e nas metricas

---

## Validacoes E2E de dashboard e metricas

Os cenarios finais tambem precisam validar a leitura executiva, nao apenas o chat.

### Dashboard comercial

Ao confirmar pagamentos no sistema:

- `nova venda confirmada` deve crescer apenas com pagamentos de checkout/pedido/proposta
- `receita recuperada` deve crescer apenas com pagamentos oriundos de recovery
- `pagamentos confirmados` agregados nao podem esconder essa separacao

### Casos obrigatorios

1. pagamento confirmado de checkout
   - aumenta `nova venda confirmada`
   - nao aumenta `receita recuperada`
2. pagamento confirmado de recovery
   - aumenta `receita recuperada`
   - nao aumenta `nova venda confirmada`
3. proposta aceita e paga
   - aumenta `nova venda confirmada`
   - conversa recebe confirmacao automatica
4. webhook duplicado
   - nao duplica mensagem
   - nao duplica receita em dashboard

### Pagina de metricas de vendas

Os testes devem confirmar que a tela de metricas separa:

- receita estimada
- nova venda capturada
- receita recuperada
- checkouts ou cobrancas ainda em aberto

Tambem validar:

- o funil comercial usa `nova venda` como receita efetivamente paga
- `recovery` nao entra como conversao de funil de novas vendas
- cards e resumos nao misturam `recovery` com `checkout`

---

## Prioridade de automacao

### P0

- saudacao inicial
- horario
- endereco
- catalogo + carrinho + cobranca
- pagamento confirmado + mensagem na conversa
- agendamento completo
- recovery pago
- proposta com aceite + pagamento

### P1

- promocoes
- cupom
- leitura de PDF
- multiplas filiais
- variacoes de profissionais e especialidades

### P2

- cenarios longos com multiplas intencoes no mesmo chat
- testes de resiliencia com retries, duplicidade e concorrencia

---

## Sugestao de implementacao tecnica

Separar a suite final em grupos:

- `messaging-greeting.e2e-spec.ts`
- `messaging-business-info.e2e-spec.ts`
- `messaging-commerce-cart.e2e-spec.ts`
- `messaging-payment-confirmation.e2e-spec.ts`
- `messaging-scheduling-flow.e2e-spec.ts`
- `messaging-recovery-flow.e2e-spec.ts`
- `messaging-proposal-flow.e2e-spec.ts`
- `messaging-pdf-reading.e2e-spec.ts`
- `messaging-promotions-coupons.e2e-spec.ts`
- `dashboard-commercial-metrics.e2e-spec.ts`

Assim a cobertura fica rastreavel e mais facil de manter.
