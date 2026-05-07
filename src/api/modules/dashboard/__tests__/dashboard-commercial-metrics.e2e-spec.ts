import { registerScenarioTodos } from '../../messaging/__tests__/messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Dashboard Commercial Metrics Flow (e2e)',
  scenarios: [
    'increases new sale revenue only for checkout and proposal payments',
    'increases recovered revenue only for recovery payments',
    'does not duplicate dashboard totals when the same webhook is replayed',
    'keeps sales metrics separating new sale revenue from recovered revenue',
  ],
});
