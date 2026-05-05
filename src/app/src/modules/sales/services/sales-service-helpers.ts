export function withBranchQuery(path: string, branchId?: string | null) {
  if (!branchId) {
    return path;
  }

  return `${path}?branchId=${encodeURIComponent(branchId)}`;
}
