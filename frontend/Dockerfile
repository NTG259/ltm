# syntax=docker/dockerfile:1
# Web SPA: build bằng Vite, phục vụ bằng nginx; /api được proxy sang Master.

FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# true = dùng Master giả lập trong trình duyệt (backend chưa có REST API);
# đặt false khi Master đã cài đặt API trong frontend/README.md.
ARG VITE_USE_MOCK=true
ARG VITE_WS_URL=
ENV VITE_USE_MOCK=$VITE_USE_MOCK VITE_WS_URL=$VITE_WS_URL
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
