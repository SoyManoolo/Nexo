import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { GithubCommit, GithubRepository } from '@nexo/contracts';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { integrationSettings } from '../db/schema.js';

const TOKEN_KEY = 'github_access_token';
const GITHUB_API = 'https://api.github.com';

export class GithubIntegrationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'GithubIntegrationError';
  }
}

function encryptionKey(): Buffer {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new GithubIntegrationError('Configura GITHUB_TOKEN_ENCRYPTION_KEY en el servidor antes de guardar el token.', 503);
  return createHash('sha256').update(secret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

function decrypt(value: string): string {
  const [iv, tag, ciphertext] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function getToken(): Promise<string | null> {
  const [setting] = await db.select().from(integrationSettings).where(eq(integrationSettings.key, TOKEN_KEY));
  return setting ? decrypt(setting.encryptedValue) : null;
}

export async function githubConnectionStatus(): Promise<{ connected: boolean }> {
  const [setting] = await db.select({ key: integrationSettings.key }).from(integrationSettings).where(eq(integrationSettings.key, TOKEN_KEY));
  return { connected: Boolean(setting) };
}

export async function saveGithubToken(token: string): Promise<void> {
  const encryptedValue = encrypt(token);
  await db.insert(integrationSettings).values({ key: TOKEN_KEY, encryptedValue, updatedAt: new Date() })
    .onConflictDoUpdate({ target: integrationSettings.key, set: { encryptedValue, updatedAt: new Date() } });
}

export async function removeGithubToken(): Promise<void> {
  await db.delete(integrationSettings).where(eq(integrationSettings.key, TOKEN_KEY));
}

function githubHeaders(token: string | null): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Nexo',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders(token), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    if (response.status === 404) throw new GithubIntegrationError('No se encontró el repositorio. Revisa la URL y los permisos del token.', 404);
    if (response.status === 401 || response.status === 403) throw new GithubIntegrationError('GitHub rechazó el token o se alcanzó el límite de consultas.', 502);
    throw new GithubIntegrationError(`GitHub respondió con ${response.status}.`, 502);
  }
  return response.json() as Promise<T>;
}

export function parseGithubRepository(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new GithubIntegrationError('Introduce la URL https://github.com/propietario/repositorio'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new GithubIntegrationError('Solo se admiten repositorios de github.com.');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0]!) || !/^[A-Za-z0-9_.-]+$/.test(parts[1]!)) {
    throw new GithubIntegrationError('Introduce la URL https://github.com/propietario/repositorio');
  }
  return `${parts[0]}/${parts[1].replace(/\.git$/, '')}`;
}

export async function getGithubRepository(repository: string): Promise<{ name: string; description: string | null }> {
  const [owner, name] = repository.split('/');
  const repo = await request<{ name: string; description: string | null }>(`/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(name!)}`);
  return { name: repo.name, description: repo.description };
}

export async function listGithubCommits(repository: string): Promise<GithubCommit[]> {
  const [owner, name] = repository.split('/');
  const commits = await request<Array<{ sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null }; author: { login: string } | null }>>(
    `/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(name!)}/commits?per_page=8`,
  );
  return commits.map((item) => ({
    sha: item.sha,
    message: item.commit.message.split('\n')[0] ?? '',
    url: item.html_url,
    author: item.author?.login ?? item.commit.author?.name ?? null,
    committedAt: new Date(item.commit.author?.date ?? Date.now()).toISOString(),
  }));
}

export async function listGithubRepositories(): Promise<GithubRepository[]> {
  const token = await getToken();
  if (!token) throw new GithubIntegrationError('Conecta GitHub desde Ajustes antes de elegir un repositorio.', 400);
  const repositories: Array<{ full_name: string; html_url: string; description: string | null; private: boolean; updated_at: string }> = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await request<typeof repositories>(`/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner%2Ccollaborator%2Corganization`);
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  return repositories.map((repo) => ({
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description,
    isPrivate: repo.private,
    updatedAt: new Date(repo.updated_at).toISOString(),
  }));
}
