# Módulo: `tenant`

**Caminho:** `src/api/modules/tenant`  
**Última análise:** 2026-05-03  
**Papel:** agregado raiz multitenant — plano, quotas em domínios conectados ao billing de referência mas armazenado aqui conforme modelo, usuários equipa, redes sociais/meta (controllers), whatsapp adapters strategy, facade `TenantFacade`.

## Valor ao utilizador / oportunidades

- **Bootstrap de conta** e primeira experiência bem configurada aumentam adoção IA + canais.
- **Melhorias:** onboarding assistido checklist; migrações de config menos sensíveis; separação dados “marketing” vs “tech config” quando o domínio crescer.
- **Enterprise:** branches/filiais (se modelo existente) com isolamento forte.

## Implementação recente (2026-05-03)

- **Marketing vs técnico (read API):** `GET /tenants/:id/profile-sections` devolve `{ marketing, technical }` sem credenciais de canal — projeção leve paralela ao agregado.
- **Onboarding checklist:** `GET /tenants/:id/onboarding-checklist` — itens derivados de negócio, canais ACTIVE, IA e PDFs `READY`.
- **Agente/skills Cursor:** usar a skill **`tenant-module-improvements`** (`.cursor/skills/tenant-module-improvements/SKILL.md`) para sessões só deste tema.

## Acoplamento / manutenção

- **Amplamente consumido como read model (`Tenant`)** via AI/domain services — forte dependência estrutural; mitigar expondo **projection DTOs** ou query services só leitura no futuro quando o modelo explodir campos privados/contratos (`profile-sections` é um passo nesse sentido).
- `TenantModule` acopla a auth e diversas ACLs infra de WhatsApp (`Dialog360ManagementAcl`, etc.) — faz sentido tecnicamente mas monitorar tamanho do módulo.

## Logs e traces distribuídos

- Configurações de canal (Instagram/WhatsApp) sensíveis a falhas de provider — já tendem ao HTTP global; usar logs estruturados em adapters com **`tenantId`**: falhas Axios em `Dialog360ManagementAcl`, `TwilioManagementAcl` (`StructuredLogEmitter`) e fluxo OAuth Meta em `MetaInstagramOAuthService`.

## KISS / DRY

- **Duplicação estratégia WhatsApp** vs messaging gateway — manter matriz única onde possível ou documentação explícita que são camadas diferentes (config vs envio mensagem).
