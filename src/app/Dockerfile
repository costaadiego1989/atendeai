# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json ./

RUN --mount=type=cache,target=/root/.npm \
  npm install --no-audit --no-fund

COPY . .

ARG VITE_API_ORIGIN
ARG VITE_API_URL
ARG VITE_PLATFORM_ADMIN_API_KEY
ARG VITE_SHOW_PLATFORM_ADMIN_NAV

ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PLATFORM_ADMIN_API_KEY=${VITE_PLATFORM_ADMIN_API_KEY}
ENV VITE_SHOW_PLATFORM_ADMIN_NAV=${VITE_SHOW_PLATFORM_ADMIN_NAV}

RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
