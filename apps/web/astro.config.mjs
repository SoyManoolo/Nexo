import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

const allowedDomains = [{ hostname: 'localhost' }, { hostname: '127.0.0.1' }];

if (process.env.WEB_ALLOWED_HOSTNAME) {
  allowedDomains.push({ hostname: process.env.WEB_ALLOWED_HOSTNAME });
}

export default defineConfig({
  adapter: node({ mode: 'standalone' }),
  output: 'server',
  security: { allowedDomains },
});
