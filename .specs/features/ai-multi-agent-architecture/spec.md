# Multi-Agent Architecture per Domain

## Classification: Large/Complex
## Modules: ai
## Approach: TDD-first, structured JSON output for determinism

## Context

Current AI pipeline uses a single generalist agent for all business types. The `PhaseDefinitionRegistry` already differentiates conversation flows by niche, but the agent itself (system prompt, tools, response schema) is identical regardless of whether the tenant is a recovery company, restaurant, or law firm.

This spec introduces **specialized agents per domain** — each with its own system prompt, tool subset, response schema, and phase definitions. An `AgentRouter` decides which agent handles each message based on tenant config, detected intent, and conversation state.

## Building Blocks Already Implemented

- `PhaseDefinitionRegistry` — niche-aware phase definitions per businessType
- `ToolExecutionService` — executes any tool call (payment, scheduling, order, automation)
- `ToolCallingChainFactory` — binds tools to LangChain model, returns structured `{ textResponse, toolCalls[] }`
- `OutputGuardrailService` — universal PII/toxic/URL guardrails
- `FakeChatModel` — supports `queueToolCall`, `queueToolCalls`, `queueResponseWithTools`
- `ConversationClassificationSchema` — includes `phase` and `phaseConfidence`
- `RedisConversationPhaseStore` — persists conversation phase state
- `TenantAgentRuleService` — per-tenant/module prompt customization

## Requirements

### R1: AgentDefinition Value Object

- **R1.1:** Each agent is defined by a JSON-serializable `AgentDefinition` containing: `id`, `name`, `systemPromptTemplate`, `tools` (subset of available ToolDefinitions), `responseSchema` (Zod), `phases` (PhaseDefinition), `defaultPhase`
- **R1.2:** AgentDefinition is immutable at runtime — loaded from registry, not constructed per-request
- **R1.3:** Each agent's `responseSchema` extends a base schema (reply, confidence, phase) with domain-specific fields
- **R1.4:** Structured JSON output — model MUST return parseable JSON matching the agent's schema (determinism)

### R2: AgentRegistry

- **R2.1:** Static registry that maps `businessType` → primary `AgentDefinition`
- **R2.2:** Supports fallback: if no specific agent for businessType, returns `SalesAgent` (generic default)
- **R2.3:** Returns all available agents (for admin UI listing)
- **R2.4:** Each agent declares which `businessTypes` it serves and which `intents` it handles

### R3: Specialized Agents

- **R3.1:** `SalesAgent` — default for ecommerce/generic. Tools: `generate_payment_link`, `trigger_automation`. Phases: ecommerce flow.
- **R3.2:** `RecoveryAgent` — for recovery tenants. Tools: `generate_payment_link`, `trigger_automation`. Phases: recovery flow. Schema adds: `debtContext`, `negotiationStatus`.
- **R3.3:** `SchedulingAgent` — for clinic/salon. Tools: `schedule_slot`, `trigger_automation`. Phases: clinic/salon flow. Schema adds: `appointmentContext`.
- **R3.4:** `CommerceAgent` — for restaurant/commerce. Tools: `repeat_last_order`, `generate_payment_link`, `trigger_automation`. Phases: restaurant flow. Schema adds: `orderContext`.
- **R3.5:** `SupportAgent` — activated by intent (COMPLAINT/SUPPORT) regardless of businessType. Tools: `trigger_automation`. Phases: universal SUPPORT/COMPLAINT only.

### R4: AgentRouter

- **R4.1:** Deterministic routing: `businessType` + `currentPhase` + detected `intent` → AgentDefinition
- **R4.2:** Priority: explicit intent override (COMPLAINT → SupportAgent) > phase-based > businessType default
- **R4.3:** Router is stateless — decision based purely on input context, no side effects
- **R4.4:** Returns the chosen agent's ID + routing reason (for observability/debugging)

### R5: Pipeline Integration

- **R5.1:** `ProcessAIResponseService` uses `AgentRouter` to select agent before AI call
- **R5.2:** Selected agent's `systemPromptTemplate` replaces generic prompt assembly
- **R5.3:** Selected agent's `tools` are bound to model via `ToolCallingChainFactory`
- **R5.4:** Selected agent's `responseSchema` is used for structured output parsing
- **R5.5:** Universal guardrails (`OutputGuardrailService`) apply AFTER agent response — not per-agent
- **R5.6:** Tenant's custom prompt rules (`TenantAgentRuleService`) are appended to the agent's prompt (not replaced)

### R6: Deterministic JSON Output

- **R6.1:** Every agent response MUST be valid JSON matching its schema — enforced by `StructuredOutputChainFactory`
- **R6.2:** If model fails to produce valid JSON after retries, fallback to SalesAgent with generic schema
- **R6.3:** Response includes routing metadata: `agentId`, `routingReason`, `phase`, `phaseConfidence`

## Non-Goals (this iteration)

- Agent handoff mid-conversation ("let me transfer you to scheduling")
- Per-tenant agent customization beyond prompt rules
- Agent memory beyond conversation phase state
- Multi-turn agent planning (ReAct loops)
- Admin UI for agent configuration
