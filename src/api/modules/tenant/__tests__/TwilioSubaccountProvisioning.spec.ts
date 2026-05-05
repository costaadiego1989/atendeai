import { ConfigService } from '@nestjs/config';
import { TwilioManagementAcl, TwilioSubaccountRecord } from '../infrastructure/acl/TwilioManagementAcl';

describe('Twilio Subaccount Provisioning (E2E)', () => {
  let twilioAcl: TwilioManagementAcl;
  let createdAccount: TwilioSubaccountRecord | null = null;

  beforeAll(() => {
    require('dotenv').config({ path: '.env' });

    const configService = new ConfigService({
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_MESSAGING_BASE_URL: process.env.TWILIO_MESSAGING_BASE_URL || 'https://messaging.twilio.com/v2',
      TWILIO_API_BASE_URL: process.env.TWILIO_API_BASE_URL || 'https://api.twilio.com/2010-04-01',
    });

    twilioAcl = new TwilioManagementAcl(configService);
  });

  it('should have TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN configured', () => {
    expect(process.env.TWILIO_ACCOUNT_SID).toBeDefined();
    expect(process.env.TWILIO_ACCOUNT_SID).toMatch(/^AC/);
    expect(process.env.TWILIO_AUTH_TOKEN).toBeDefined();
    expect(process.env.TWILIO_AUTH_TOKEN!.length).toBeGreaterThanOrEqual(20);
  });

  it('should create a real Twilio subaccount for a tenant', async () => {
    const testTenantId = 'e2e-test-' + Date.now();
    const friendlyName = `E2E Test Tenant ${testTenantId}`;

    createdAccount = await twilioAcl.createSubaccount({ friendlyName });

    expect(createdAccount).toBeDefined();
    expect(createdAccount.sid).toBeDefined();
    expect(createdAccount.sid).toMatch(/^AC/); // Twilio account SIDs always start with "AC"
    expect(createdAccount.authToken).toBeDefined();
    expect(createdAccount.authToken.length).toBeGreaterThanOrEqual(20);
    expect(createdAccount.status).toBe('active');
    expect(createdAccount.friendlyName).toContain('E2E Test Tenant');

    console.log('--- Twilio Subaccount Created ---');
    console.log(`  SID:          ${createdAccount.sid}`);
    console.log(`  FriendlyName: ${createdAccount.friendlyName}`);
    console.log(`  Status:       ${createdAccount.status}`);
    console.log(`  AuthToken:    ${createdAccount.authToken.slice(0, 6)}...`);
  }, 30000);

  it('should return a subaccount with credentials usable for API calls', () => {
    expect(createdAccount).not.toBeNull();

    const credentials = {
      accountSid: createdAccount!.sid,
      authToken: createdAccount!.authToken,
    };

    expect(credentials.accountSid).toMatch(/^AC[a-f0-9]{32}$/);
    expect(typeof credentials.authToken).toBe('string');
    expect(credentials.authToken.length).toBe(32);
  });
});
