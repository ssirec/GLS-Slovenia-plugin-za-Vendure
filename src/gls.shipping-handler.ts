import { ShippingEligibilityChecker } from '@vendure/core';

export const glsEligibilityChecker = new ShippingEligibilityChecker({
  code: 'gls-shipping',
  description: [{ languageCode: 'sl', value: 'GLS dostava' }],
  check: async () => true,
});
