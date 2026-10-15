# Use a slim Node.js runtime image.
FROM node:22-bookworm-slim

WORKDIR /app

# Install the lockfile-defined production dependency tree.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy only the API context, prepare writable runtime storage, and run without root privileges.
COPY --chown=node:node . .
RUN mkdir -p /app/data/logs && chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
