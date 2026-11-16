FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci \
    && cat package.json package-lock.json | sha256sum | awk '{print $1}' > node_modules/.dependency-hash

COPY . .
COPY docker-entrypoint.sh /usr/local/bin/frontend-entrypoint.sh

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

ENTRYPOINT ["sh", "/usr/local/bin/frontend-entrypoint.sh"]
CMD ["npm", "run", "dev"]
