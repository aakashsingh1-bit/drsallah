FROM node:20-bookworm-slim AS build

WORKDIR /app

# react-scripts needs native build tools on Linux
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ARG REACT_APP_API_URL

ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    CI=true \
    GENERATE_SOURCEMAP=false \
    NODE_OPTIONS=--max-old-space-size=4096

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
