# FEATURES - `auth`

## Estado atual

O modulo cobre login, refresh, logout, usuario atual, recuperacao de senha e protecoes de throttling. Ele sustenta confianca, seguranca e continuidade de acesso.

## Features de alto valor

| Prioridade | Feature | Status | Valor para usuario | Criterio de sucesso |
|------------|---------|--------|--------------------|---------------------|
| P0 | Auditoria de login e sessoes | recomendado | Donos enxergam acessos suspeitos e reduzem risco de conta comprometida. | Eventos de login/logout/refresh aparecem por usuario, IP e device. |
| P0 | Sessao por dispositivo com revogacao | parcial | Usuario encerra acesso em aparelhos perdidos ou compartilhados. | Revogar uma sessao invalida refresh daquele dispositivo. |
| P1 | MFA opcional para owners/admins | recomendado | Aumenta seguranca de contas com acesso financeiro e operacional. | MFA ativado em contas criticas sem aumentar abandono de login. |
| P1 | SSO/OIDC para contas enterprise | nao recomendado agora | Valor alto para clientes maiores, baixo para SMB inicial. | Priorizar quando houver demanda enterprise concreta. |
| P2 | Alertas de login suspeito | recomendado | Cliente recebe aviso rapido de comportamento anormal. | Alertas enviados quando houver novo device/localizacao incomum. |

## Observacao

O modulo esta funcional; proximas features devem focar seguranca visivel e controle pelo dono da conta.
