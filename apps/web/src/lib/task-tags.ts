export const taskTagOptions = ['diseño', 'urgente', 'ideas', 'desarrollo', 'bug', 'documentación'] as const;

export function selectedTags(form: FormData): string[] {
  return form.getAll('tags').map(String).filter(Boolean);
}

export function tagChoices(current: string[]): string[] {
  return [...new Set([...taskTagOptions, ...current])];
}
