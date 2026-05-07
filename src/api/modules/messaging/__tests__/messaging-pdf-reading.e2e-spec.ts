import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging PDF Reading Flow (e2e)',
  scenarios: [
    'reads a text pdf uploaded to the tenant knowledge base',
    'summarizes the relevant content of the uploaded pdf in the conversation',
    'rejects corrupted or empty pdf files without hallucinating content',
  ],
});
