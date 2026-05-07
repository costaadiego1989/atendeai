import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Greeting Flow (e2e)',
  scenarios: [
    'greets a new contact and persists inbound plus outbound messages',
    'reuses the active conversation when the same contact says hello again',
    'does not create checkout, recovery, or scheduling side effects during greeting',
  ],
});
