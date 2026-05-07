import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Payment Confirmation Flow (e2e)',
  scenarios: [
    'reflects a checkout payment confirmation in the conversation after the webhook',
    'marks new sale revenue without mixing it with recovered revenue',
    'keeps webhook processing idempotent when the same payment event arrives twice',
    'allows sale attribution as completed when objective payment evidence exists',
  ],
});
