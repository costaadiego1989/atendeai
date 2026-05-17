import { AuthUser } from '../domain/entities/AuthUser';
import { AuthUserEmail } from '../domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('AuthUser', () => {
  function createUser(
    overrides: Partial<{
      id: string;
      tenantId: string;
      tenantName: string;
      tenantBranches: Array<{
        id: string;
        name: string;
        isHeadquarters: boolean;
        active: boolean;
      }>;
      email: string;
      name: string;
      passwordHash: string;
      mustChangePassword: boolean;
      role: string;
      planStatus: string;
    }> = {},
  ) {
    return AuthUser.create(
      {
        tenantId: overrides.tenantId ?? 'tenant-1',
        tenantName: overrides.tenantName ?? 'My Tenant',
        tenantBranches: overrides.tenantBranches ?? [],
        email: AuthUserEmail.create(overrides.email ?? 'user@test.com'),
        name: overrides.name ?? 'Test User',
        passwordHash: overrides.passwordHash ?? 'hashed_pw',
        mustChangePassword: overrides.mustChangePassword ?? false,
        role: Role.create(overrides.role ?? 'OWNER'),
        planStatus: overrides.planStatus ?? 'ACTIVE',
        tenantCreatedAt: new Date('2025-01-01'),
      },
      overrides.id ? new UniqueEntityID(overrides.id) : undefined,
    );
  }

  it('should create with valid data', () => {
    const user = createUser({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'john@example.com',
      name: 'John Doe',
    });

    expect(user.id.toString()).toBe('user-1');
    expect(user.tenantId).toBe('tenant-1');
    expect(user.email.value).toBe('john@example.com');
    expect(user.name).toBe('John Doe');
    expect(user.passwordHash).toBe('hashed_pw');
  });

  it('should create with role OWNER', () => {
    const user = createUser({ role: 'OWNER' });
    expect(user.role.value).toBe('OWNER');
  });

  it('should create with role ADMIN', () => {
    const user = createUser({ role: 'ADMIN' });
    expect(user.role.value).toBe('ADMIN');
  });

  it('should create with role AGENT', () => {
    const user = createUser({ role: 'AGENT' });
    expect(user.role.value).toBe('AGENT');
  });

  it('should default mustChangePassword to false', () => {
    const user = createUser();
    expect(user.mustChangePassword).toBe(false);
  });

  it('should support mustChangePassword=true', () => {
    const user = createUser({ mustChangePassword: true });
    expect(user.mustChangePassword).toBe(true);
  });

  it('should filter branches by active status', () => {
    const user = createUser({
      tenantBranches: [
        { id: 'b1', name: 'Matriz', isHeadquarters: true, active: true },
        {
          id: 'b2',
          name: 'Filial Inativa',
          isHeadquarters: false,
          active: false,
        },
        { id: 'b3', name: 'Filial Ativa', isHeadquarters: false, active: true },
      ],
    });

    const activeBranches = user.tenantBranches.filter((b: any) => b.active);
    expect(activeBranches).toHaveLength(2);
    expect(activeBranches.map((b: any) => b.id)).toEqual(['b1', 'b3']);
  });

  it('should determine equality by id', () => {
    const user1 = createUser({ id: 'same-id', email: 'a@test.com', name: 'A' });
    const user2 = createUser({ id: 'same-id', email: 'b@test.com', name: 'B' });
    const user3 = createUser({
      id: 'different-id',
      email: 'a@test.com',
      name: 'A',
    });

    expect(user1.equals(user2)).toBe(true);
    expect(user1.equals(user3)).toBe(false);
  });
});
