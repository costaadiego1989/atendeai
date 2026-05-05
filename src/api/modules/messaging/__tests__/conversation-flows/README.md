# Conversation flows live E2E

This folder keeps the long running conversation tests separated from the fast messaging specs.

The AI engine is not mocked here. The suite only runs when explicitly enabled:

```powershell
$env:RUN_REAL_CONVERSATION_FLOW_E2E='true'
$env:CONVERSATION_FLOW_TENANT_ID='3251266a-e4e1-4f12-80ae-81314f0b2b9a'
cmd /c node node_modules\jest\bin\jest.js --config test\jest-e2e.json --runTestsByPath modules\messaging\__tests__\conversation-flows\conversation-flow-live.e2e-spec.ts --runInBand --forceExit
```

Optional narrow run:

```powershell
$env:CONVERSATION_FLOW_NICHES='FOOD,CLINIC,ECOMMERCE'
```

The live suite uses the configured DeepSeek adapter and the selected tenant. Outbound queues and payment gateway calls are isolated so the tests do not send real WhatsApp messages or create real charges while validating the full inbound webhook, AI response, commerce, scheduling and abandonment paths.
