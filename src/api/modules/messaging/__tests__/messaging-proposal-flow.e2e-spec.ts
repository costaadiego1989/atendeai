import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Proposal Flow (e2e)',
  scenarios: [
    'sends the public proposal link in the conversation instead of only the pdf',
    'records customer acceptance from the public proposal page',
    'generates a payment link after acceptance and posts it in the conversation',
    'confirms the proposal payment in the conversation after the webhook',
    'allows sale attribution only after the proposal has payment confirmation',
  ],
});
