FROM node:24-alpine AS external-website

RUN npm install -g pnpm@10.15.1

ENV NODE_ENV production
ENV NODE_ENV_ALIAS staging

ENV APP_PATH /app/frontend
ENV LOCAL_APP_PATH ./app/frontend

RUN mkdir -p $APP_PATH

COPY $LOCAL_APP_PATH/package.json $LOCAL_APP_PATH/pnpm-lock.yaml $APP_PATH/

# The WORKDIR instruction sets the working directory for everything that will happen next
WORKDIR $APP_PATH

# Copy all local files into the image
COPY $LOCAL_APP_PATH .

# Clean install all node modules
RUN pnpm install --frozen-lockfile
RUN pnpm svelte-kit sync
RUN pnpm run build:parser

# Build SvelteKit app
# The API base URL is not built in: the app calls /api/v1/<service> on its own
# origin, which nginx routes to the services. One image serves every domain.
# Sentry is compiled in at build time; an empty DSN disables it.
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_TRACES_SAMPLE_RATE=1.0
ARG VITE_SENTRY_REPLAY_SAMPLE_RATE=0.1
ARG VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1.0
RUN VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_SENTRY_TRACES_SAMPLE_RATE=${VITE_SENTRY_TRACES_SAMPLE_RATE} \
    VITE_SENTRY_REPLAY_SAMPLE_RATE=${VITE_SENTRY_REPLAY_SAMPLE_RATE} \
    VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=${VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE} \
    pnpm run build --mode $NODE_ENV_ALIAS

# Plugin frontend bundles are not built here: the setting service builds and
# serves them (see app/setting/Dockerfile).

# Delete source code files that were used to build the app that are no longer needed
RUN rm -rf static/ emailTemplates/ docker-compose.yml

# The USER instruction sets the user name to use as the default user for the remainder of the current stage
USER node:node

# This is the command that will be run inside the image when you tell Docker to start the container
CMD ["node","build/index.js"]