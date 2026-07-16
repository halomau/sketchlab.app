# syntax=docker/dockerfile:1
# Stage 1: Build the application
FROM node:26.5.0-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine-slim
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
