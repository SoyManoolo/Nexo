import sharp from 'sharp';

const MAX_INPUT_PIXELS = 40_000_000;
const MAX_DIMENSION = 2560;
const IMAGE_FORMATS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
};

export class InvalidTaskImageError extends Error {
  constructor() {
    super('La imagen no es válida o no coincide con el tipo de archivo indicado.');
    this.name = 'InvalidTaskImageError';
  }
}

export async function optimizeTaskImage(
  content: Buffer,
  mimeType: string,
): Promise<{ content: Buffer; mimeType: string }> {
  if (!(mimeType in IMAGE_FORMATS)) return { content, mimeType };

  try {
    const image = sharp(content, { limitInputPixels: MAX_INPUT_PIXELS });
    const metadata = await image.metadata();
    if (metadata.format !== IMAGE_FORMATS[mimeType]) throw new InvalidTaskImageError();

    // Preserve animated WebP files: flattening them would discard frames.
    if ((metadata.pages ?? 1) > 1) return { content, mimeType };

    const optimized = await image
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    return optimized.length < content.length
      ? { content: optimized, mimeType: 'image/webp' }
      : { content, mimeType };
  } catch (error) {
    if (error instanceof InvalidTaskImageError) throw error;
    throw new InvalidTaskImageError();
  }
}
