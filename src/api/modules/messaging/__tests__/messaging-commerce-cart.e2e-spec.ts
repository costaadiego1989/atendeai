import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Commerce Cart Flow (e2e)',
  scenarios: [
    'builds a cart from a complete purchase intent with multiple items',
    'shows the current cart with quantities, subtotal, and total',
    'applies a valid coupon before checkout and recalculates the total',
    'rejects invalid, expired, or ineligible coupons',
    'creates a payment link after the customer confirms the order',
  ],
});
