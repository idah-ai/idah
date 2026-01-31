FROM node:bullseye-slim

RUN npm install -g pnpm@10.15.1

ENV LOCAL_APP_PATH=.
ENV APP_PATH=/app/frontend

RUN mkdir -p $APP_PATH/src

COPY $LOCAL_APP_PATH $APP_PATH

WORKDIR $APP_PATH

RUN pnpm install --frozen-lockfile --force
RUN pnpm run build:parser
RUN pnpm svelte-kit sync
RUN pnpm run build:idah-video
