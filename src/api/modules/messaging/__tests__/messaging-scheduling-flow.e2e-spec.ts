import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Scheduling Flow (e2e)',
  scenarios: [
    'lists active professionals for the requested service',
    'lists specialties available for scheduling',
    'shows slots for a specific professional and date',
    'books a slot from discovery to confirmation',
    'sends a payment link and confirms the booking after payment when prepayment is required',
  ],
});
