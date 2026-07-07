import {
  isValidTransition,
  isValidPhase,
  isUniversalPhase,
  getInitialPhase,
  PhaseDefinitionRegistry,
  CONVERSATION_PHASES,
  BusinessType,
} from '../ConversationPhase';

describe('ConversationPhase', () => {
  describe('CONVERSATION_PHASES (backward compat)', () => {
    it('has 8 phases (generic/ecommerce)', () => {
      expect(CONVERSATION_PHASES).toHaveLength(8);
    });

    it('includes universal phases', () => {
      expect(CONVERSATION_PHASES).toContain('GREETING');
      expect(CONVERSATION_PHASES).toContain('SUPPORT');
      expect(CONVERSATION_PHASES).toContain('COMPLAINT');
    });
  });

  describe('PhaseDefinitionRegistry', () => {
    it('returns generic definition for unknown business type', () => {
      const def = PhaseDefinitionRegistry.getDefinition(
        'unknown' as BusinessType,
      );
      expect(def.phases).toEqual(CONVERSATION_PHASES);
    });

    it('returns ecommerce phases', () => {
      const phases = PhaseDefinitionRegistry.getPhases('ecommerce');
      expect(phases).toContain('PRODUCT_DISCOVERY');
      expect(phases).toContain('QUOTE');
      expect(phases).toContain('CHECKOUT');
    });

    it('returns clinic phases', () => {
      const phases = PhaseDefinitionRegistry.getPhases('clinic');
      expect(phases).toContain('SCHEDULING');
      expect(phases).toContain('FOLLOW_UP');
      expect(phases).not.toContain('CHECKOUT');
    });

    it('returns law phases', () => {
      const phases = PhaseDefinitionRegistry.getPhases('law');
      expect(phases).toContain('CASE_ASSESSMENT');
      expect(phases).toContain('PROPOSAL');
      expect(phases).toContain('ONBOARDING');
    });

    it('returns restaurant phases', () => {
      const phases = PhaseDefinitionRegistry.getPhases('restaurant');
      expect(phases).toContain('ORDER_TAKING');
      expect(phases).toContain('CUSTOMIZATION');
      expect(phases).toContain('DELIVERY_TRACKING');
    });

    it('returns recovery phases', () => {
      const phases = PhaseDefinitionRegistry.getPhases('recovery');
      expect(phases).toContain('DEBT_IDENTIFICATION');
      expect(phases).toContain('NEGOTIATION');
      expect(phases).toContain('PROMISE_TO_PAY');
    });

    it('returns salon phases', () => {
      const phases = PhaseDefinitionRegistry.getPhases('salon');
      expect(phases).toContain('SERVICE_SELECTION');
      expect(phases).toContain('PROFESSIONAL_SELECTION');
    });

    it('lists all supported business types', () => {
      const types = PhaseDefinitionRegistry.getSupportedBusinessTypes();
      expect(types).toContain('ecommerce');
      expect(types).toContain('clinic');
      expect(types).toContain('law');
      expect(types).toContain('restaurant');
      expect(types).toContain('recovery');
      expect(types).toContain('salon');
      expect(types).toContain('generic');
      expect(types).toHaveLength(7);
    });

    it('all niches include universal phases', () => {
      const types = PhaseDefinitionRegistry.getSupportedBusinessTypes();
      for (const type of types) {
        const phases = PhaseDefinitionRegistry.getPhases(type);
        expect(phases).toContain('GREETING');
        expect(phases).toContain('SUPPORT');
        expect(phases).toContain('COMPLAINT');
      }
    });

    it('all niches have GREETING as first phase', () => {
      const types = PhaseDefinitionRegistry.getSupportedBusinessTypes();
      for (const type of types) {
        const phases = PhaseDefinitionRegistry.getPhases(type);
        expect(phases[0]).toBe('GREETING');
      }
    });

    it('transitions reference only phases that exist in same niche', () => {
      const types = PhaseDefinitionRegistry.getSupportedBusinessTypes();
      for (const type of types) {
        const def = PhaseDefinitionRegistry.getDefinition(type);
        for (const [from, targets] of Object.entries(def.transitions)) {
          expect(def.phases).toContain(from);
          for (const to of targets) {
            expect(def.phases).toContain(to);
          }
        }
      }
    });
  });

  describe('isValidPhase', () => {
    it('returns true for valid generic phases', () => {
      expect(isValidPhase('GREETING')).toBe(true);
      expect(isValidPhase('CHECKOUT')).toBe(true);
    });

    it('returns false for invalid strings', () => {
      expect(isValidPhase('INVALID')).toBe(false);
      expect(isValidPhase('')).toBe(false);
    });

    it('validates niche-specific phases', () => {
      expect(isValidPhase('SCHEDULING', 'clinic')).toBe(true);
      expect(isValidPhase('SCHEDULING', 'ecommerce')).toBe(false);
      expect(isValidPhase('ORDER_TAKING', 'restaurant')).toBe(true);
      expect(isValidPhase('ORDER_TAKING', 'generic')).toBe(false);
    });
  });

  describe('isValidTransition', () => {
    describe('generic (ecommerce) transitions', () => {
      it('GREETING → QUALIFICATION', () => {
        expect(isValidTransition('GREETING', 'QUALIFICATION')).toBe(true);
      });

      it('GREETING → PRODUCT_DISCOVERY', () => {
        expect(isValidTransition('GREETING', 'PRODUCT_DISCOVERY')).toBe(true);
      });

      it('QUALIFICATION → QUOTE', () => {
        expect(isValidTransition('QUALIFICATION', 'QUOTE')).toBe(true);
      });

      it('QUOTE → CHECKOUT', () => {
        expect(isValidTransition('QUOTE', 'CHECKOUT')).toBe(true);
      });

      it('CHECKOUT → CONFIRMATION', () => {
        expect(isValidTransition('CHECKOUT', 'CONFIRMATION')).toBe(true);
      });

      it('any phase → COMPLAINT', () => {
        expect(isValidTransition('GREETING', 'COMPLAINT')).toBe(true);
        expect(isValidTransition('QUALIFICATION', 'COMPLAINT')).toBe(true);
        expect(isValidTransition('CHECKOUT', 'COMPLAINT')).toBe(true);
      });

      it('COMPLAINT → SUPPORT (de-escalation)', () => {
        expect(isValidTransition('COMPLAINT', 'SUPPORT')).toBe(true);
      });

      it('same phase → same phase (stay)', () => {
        expect(isValidTransition('GREETING', 'GREETING')).toBe(true);
        expect(isValidTransition('CHECKOUT', 'CHECKOUT')).toBe(true);
      });
    });

    describe('invalid generic transitions', () => {
      it('GREETING → CHECKOUT (skip phases)', () => {
        expect(isValidTransition('GREETING', 'CHECKOUT')).toBe(false);
      });

      it('GREETING → CONFIRMATION', () => {
        expect(isValidTransition('GREETING', 'CONFIRMATION')).toBe(false);
      });

      it('CONFIRMATION → CHECKOUT (no going back to checkout)', () => {
        expect(isValidTransition('CONFIRMATION', 'CHECKOUT')).toBe(false);
      });

      it('COMPLAINT → CHECKOUT', () => {
        expect(isValidTransition('COMPLAINT', 'CHECKOUT')).toBe(false);
      });

      it('CHECKOUT → GREETING (must go through confirmation)', () => {
        expect(isValidTransition('CHECKOUT', 'GREETING')).toBe(false);
      });
    });

    describe('niche-specific transitions', () => {
      it('clinic: QUALIFICATION → SCHEDULING', () => {
        expect(
          isValidTransition('QUALIFICATION', 'SCHEDULING', 'clinic'),
        ).toBe(true);
      });

      it('clinic: GREETING → SCHEDULING (direct)', () => {
        expect(
          isValidTransition('GREETING', 'SCHEDULING', 'clinic'),
        ).toBe(true);
      });

      it('clinic: SCHEDULING → CONFIRMATION', () => {
        expect(
          isValidTransition('SCHEDULING', 'CONFIRMATION', 'clinic'),
        ).toBe(true);
      });

      it('restaurant: GREETING → ORDER_TAKING', () => {
        expect(
          isValidTransition('GREETING', 'ORDER_TAKING', 'restaurant'),
        ).toBe(true);
      });

      it('restaurant: ORDER_TAKING → CUSTOMIZATION', () => {
        expect(
          isValidTransition('ORDER_TAKING', 'CUSTOMIZATION', 'restaurant'),
        ).toBe(true);
      });

      it('recovery: NEGOTIATION → PROMISE_TO_PAY', () => {
        expect(
          isValidTransition('NEGOTIATION', 'PROMISE_TO_PAY', 'recovery'),
        ).toBe(true);
      });

      it('salon: SERVICE_SELECTION → PROFESSIONAL_SELECTION', () => {
        expect(
          isValidTransition(
            'SERVICE_SELECTION',
            'PROFESSIONAL_SELECTION',
            'salon',
          ),
        ).toBe(true);
      });

      it('law: CASE_ASSESSMENT → PROPOSAL', () => {
        expect(
          isValidTransition('CASE_ASSESSMENT', 'PROPOSAL', 'law'),
        ).toBe(true);
      });

      it('invalid phase for niche returns false', () => {
        expect(
          isValidTransition('GREETING', 'CHECKOUT', 'clinic'),
        ).toBe(false);
      });
    });
  });

  describe('isUniversalPhase', () => {
    it('GREETING is universal', () => {
      expect(isUniversalPhase('GREETING')).toBe(true);
    });

    it('SUPPORT is universal', () => {
      expect(isUniversalPhase('SUPPORT')).toBe(true);
    });

    it('COMPLAINT is universal', () => {
      expect(isUniversalPhase('COMPLAINT')).toBe(true);
    });

    it('CHECKOUT is not universal', () => {
      expect(isUniversalPhase('CHECKOUT')).toBe(false);
    });
  });

  describe('getInitialPhase', () => {
    it('returns GREETING', () => {
      expect(getInitialPhase()).toBe('GREETING');
    });
  });
});
