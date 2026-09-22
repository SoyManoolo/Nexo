export function formValue(form: FormData | null, name: string, fallback = ''): string {
  const value = form?.get(name);
  return typeof value === 'string' ? value : fallback;
}
