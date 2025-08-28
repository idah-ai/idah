FROM node:20-alpine

RUN npm install -g pnpm@10.14

ENV LOCAL_APP_PATH .
ENV APP_PATH /app/frontend

RUN mkdir -p $APP_PATH
RUN mkdir -p $APP_PATH/src

COPY $LOCAL_APP_PATH $APP_PATH

WORKDIR $APP_PATH

RUN pnpm install --frozen-lockfile
RUN pnpm svelte-kit sync
