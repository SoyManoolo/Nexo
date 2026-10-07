import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

export type StoredTaskAttachment = { storageKey: string; mimeType: string };

const uploadDirectory = process.env.NEXO_UPLOADS_DIR ?? 'uploads';
const extensions: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
  'application/pdf': '.pdf', 'text/plain': '.txt',
};

export function attachmentPath(attachment: StoredTaskAttachment, directory = uploadDirectory): string {
  const extension = extensions[attachment.mimeType];
  if (!extension) throw new Error(`Unsupported stored attachment type: ${attachment.mimeType}`);
  return join(directory, `${attachment.storageKey}${extension}`);
}

export async function removeStoredAttachments(attachments: StoredTaskAttachment[], directory = uploadDirectory): Promise<void> {
  await Promise.all(attachments.map(async (attachment) => {
    try {
      await unlink(attachmentPath(attachment, directory));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }));
}
