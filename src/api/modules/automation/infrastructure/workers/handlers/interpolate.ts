/**
 * Replaces `{{varName}}` placeholders in a template with values from the
 * execution variables. Unknown variables are left untouched.
 */
export function interpolate(
  template: string,
  variables: Record<string, unknown>,
): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = variables[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}
