export const testAutomationData = {
  basic: {
    name: 'Test Automation',
    description: 'A test automation for E2E testing',
    trigger: {
      name: 'New Contact Trigger',
      type: 'contact.new',
      condition: 'contact.tags.includes("new")',
      delay: '5'
    },
    action: {
      name: 'Send Welcome Message',
      type: 'messaging.whatsapp',
      template: 'Welcome! Thanks for joining us.',
      delay: '10'
    }
  },
  
  complex: {
    name: 'Complex Automation',
    description: 'A complex automation with multiple triggers and actions',
    triggers: [
      {
        name: 'New Contact',
        type: 'contact.new',
        condition: 'contact.tags.includes("new")',
        delay: '5'
      },
      {
        name: 'Contact Update',
        type: 'contact.update',
        condition: 'contact.status === "premium"',
        delay: '10'
      }
    ],
    actions: [
      {
        name: 'Send Welcome Message',
        type: 'messaging.whatsapp',
        template: 'Welcome! Thanks for joining us.',
        delay: '15'
      },
      {
        name: 'Send Premium Offer',
        type: 'email.send',
        template: 'Premium offer for you!',
        delay: '20'
      }
    ]
  },
  
  conditional: {
    name: 'Conditional Automation',
    description: 'An automation with conditional logic',
    trigger: {
      name: 'New Contact',
      type: 'contact.new',
      condition: 'contact.tags.includes("new")',
      delay: '5'
    },
    condition: {
      name: 'Check Contact Type',
      expression: 'contact.type === "premium"',
      trueAction: {
        name: 'Send Premium Message',
        type: 'messaging.whatsapp',
        template: 'Premium welcome message!',
        delay: '10'
      },
      falseAction: {
        name: 'Send Standard Message',
        type: 'messaging.whatsapp',
        template: 'Standard welcome message!',
        delay: '10'
      }
    }
  },
  
  searchTestData: {
    byName: 'Welcome Automation',
    byDescription: 'New customer welcome',
    byTriggerType: 'contact.new',
    byActionType: 'messaging.whatsapp',
    byStatus: 'active',
    byDateRange: {
      from: '2024-01-01',
      to: '2024-12-31'
    }
  },
  
  metricsTestData: {
    timeRanges: ['7d', '30d', '90d', '1y'],
    statuses: ['active', 'paused', 'error'],
    exportFormats: ['csv', 'json', 'pdf']
  }
};

export const testUserCredentials = {
  admin: {
    email: 'admin@atendeai.com',
    password: 'password123'
  },
  user: {
    email: 'user@atendeai.com',
    password: 'password123'
  }
};

export const testAutomationTemplates = {
  welcome: {
    name: 'Welcome Automation',
    description: 'Automatically welcome new contacts',
    triggers: [
      {
        name: 'New Contact',
        type: 'contact.new',
        condition: 'contact.tags.includes("new")',
        delay: '5'
      }
    ],
    actions: [
      {
        name: 'Send Welcome Message',
        type: 'messaging.whatsapp',
        template: 'Welcome! Thanks for joining us.',
        delay: '10'
      }
    ]
  },
  
  followUp: {
    name: 'Follow-up Automation',
    description: 'Send follow-up messages to inactive contacts',
    triggers: [
      {
        name: 'Contact Inactivity',
        type: 'contact.inactive',
        condition: 'contact.lastInteraction < 7 days',
        delay: '1'
      }
    ],
    actions: [
      {
        name: 'Send Follow-up Message',
        type: 'messaging.whatsapp',
        template: 'Checking in on you!',
        delay: '0'
      }
    ]
  },
  
  birthday: {
    name: 'Birthday Automation',
    description: 'Send birthday wishes to contacts',
    triggers: [
      {
        name: 'Birthday',
        type: 'contact.birthday',
        condition: 'contact.birthday === today',
        delay: '0'
      }
    ],
    actions: [
      {
        name: 'Send Birthday Message',
        type: 'messaging.whatsapp',
        template: 'Happy Birthday! 🎉',
        delay: '0'
      }
    ]
  }
};