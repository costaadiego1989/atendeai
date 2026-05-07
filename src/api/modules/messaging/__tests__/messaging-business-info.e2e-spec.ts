import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Business Info Flow (e2e)',
  scenarios: [
    'answers opening hours using the tenant operating hours',
    'answers whether the business is open now for the requested day and branch',
    'answers the tenant address without creating a transactional flow',
    'answers hours plus address in the same turn',
    'asks for clarification when multiple branches could match the request',
  ],
});
