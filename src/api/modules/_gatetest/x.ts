export async function bad(prisma: any) {
  const a = await prisma.contact.findMany({ where: { name: 'x' } });
  const b = await prisma.invoice.update({ where: { tenantId: 't', id: '1' }, data: {} });
  // tenant-safe: global plan catalog, not tenant-owned
  const c = await prisma.plan.findMany({ where: { active: true } });
  const d = await prisma.tenant.findUnique({ where: { id: 't' } });
  return { a, b, c, d };
}
