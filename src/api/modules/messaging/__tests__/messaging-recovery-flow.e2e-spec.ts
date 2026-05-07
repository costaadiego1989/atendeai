import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Recovery Flow (e2e)',
  scenarios: [
    'sends a recovery payment link in the conversation',
    'marks the recovery case as paid after the webhook',
    'sends an automatic confirmation message in the conversation for recovered revenue',
    'does not allow recovered revenue to be counted as a new sale',
  ],
});
