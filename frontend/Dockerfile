FROM node:20.19-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Endereco da API embutido no bundle no momento do build.
ARG VITE_API_BASE_URL=http://localhost:4444
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:20.19-alpine
WORKDIR /app
RUN npm install -g serve@14.2.4
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
