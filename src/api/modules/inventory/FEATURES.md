# FEATURES - `inventory`

## Estado atual

O modulo gerencia conexoes e sincronizacao de estoque, incluindo snapshots manuais e provedores externos. Ele protege a venda contra ruptura e overselling.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Sync confiavel por provedor | parcial | Cliente vende com estoque atualizado e menos erro manual. | Taxa de sync com sucesso e ultima sincronizacao ficam visiveis. |
| P0 | Alerta de ruptura e baixo estoque | recomendado | Dono age antes de perder vendas. | Itens abaixo do limite geram alerta e reposicao. |
| P0 | Estoque por filial/canal | recomendado | Evita oferecer produto indisponivel no local correto. | Checkout considera branch/canal antes de confirmar pedido. |
| P1 | Historico de divergencias | recomendado | Ajuda auditar por que um item mudou de estoque. | Alteracoes relevantes mostram origem, data e provedor. |
| P2 | Reserva de estoque em carrinho | recomendado | Reduz overselling, mas exige regras claras de expiracao. | Carrinhos pagos nao falham por estoque vendido em paralelo. |

## Observacao

Inventario so gera valor quando esta conectado ao catalogo e ao checkout. Cadastro isolado de estoque tem baixo impacto.
