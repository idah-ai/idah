FROM node:18-alpine

RUN npm install -g pnpm@10.14

ENV LOCAL_APP_PATH .
ENV APP_PATH /app/frontend

RUN mkdir -p $APP_PATH

COPY $LOCAL_APP_PATH/package.json $LOCAL_APP_PATH/pnpm-lock.yaml $APP_PATH/

WORKDIR $APP_PATH

RUN pnpm install --frozen-lockfile
RUN pnpm svelte-kit sync
