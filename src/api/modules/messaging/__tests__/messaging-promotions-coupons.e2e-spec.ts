import { registerScenarioTodos } from './messaging-e2e-scenarios';

registerScenarioTodos({
  suite: 'Messaging Promotions and Coupons Flow (e2e)',
  scenarios: [
    'shows active promotions only',
    'explains how to use a coupon before the order is finalized',
    'combines promotions and coupon guidance in the same answer when the user asks both',
  ],
});
