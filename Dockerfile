FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable
ARG WEB_ALLOWED_HOSTNAME
ENV WEB_ALLOWED_HOSTNAME=${WEB_ALLOWED_HOSTNAME}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
ARG APP_PACKAGE
RUN pnpm --filter "${APP_PACKAGE}" build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
ARG APP_PACKAGE
ENV APP_PACKAGE=${APP_PACKAGE}
CMD ["sh", "-c", "pnpm --filter \"$APP_PACKAGE\" start"]
