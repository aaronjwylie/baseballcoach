# Dev image for the "app" compose profile. Source is bind-mounted by
# docker-compose for hot reload, so this only needs deps + the dev server.
# A production image (multi-stage `next build` → `next start`) comes with the
# Vercel port; local dev doesn't need it.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
