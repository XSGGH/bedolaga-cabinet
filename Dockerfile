# Stage 1: Build the React application
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_API_URL=/api
ARG VITE_TELEGRAM_BOT_USERNAME
ARG VITE_APP_NAME=Cabinet
ARG VITE_APP_LOGO=V

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_LOGO=$VITE_APP_LOGO

# Build the application. Type-check намеренно пропущен: tsc --noEmit уже
# гоняется CI на каждый PR (lint.yml), образ собирается из проверенного
# коммита - повторная проверка стоила бы ~10s на каждую сборку.
RUN npm run build:docker

# Stage 2: Serve with Nginx
FROM nginx:alpine

RUN apk add --no-cache ca-certificates && update-ca-certificates

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Git checkouts made by the private backup/deploy shell can have umask 077.
# Vite preserves public-file modes; nginx workers must still read public assets.
RUN find /usr/share/nginx/html -type d -exec chmod 755 {} + && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} +
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/19-uptime-env.sh /docker-entrypoint.d/19-uptime-env.sh
RUN chmod +x /docker-entrypoint.d/19-uptime-env.sh
# Only the runtime secret is substituted; nginx variables must remain intact.
ENV XSG_UPTIME_API_KEY=""
ENV NGINX_ENVSUBST_FILTER="^XSG_UPTIME_API_KEY$"

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

