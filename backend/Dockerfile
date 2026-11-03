FROM node:20-alpine

# ffmpeg: conversao de audio do chat (WhatsApp).
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p .runtime && chown -R node:node /app
USER node

EXPOSE 4444
CMD ["node", "src/app.js"]
