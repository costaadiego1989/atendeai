export function prospectMessageHasNameTokens(template: string): boolean {
  const value = template.trim();
  return value.includes('{{first_name}}') || value.includes('{{name}}');
}
