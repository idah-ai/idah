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

# Build SvelteKit app. Nothing environment-specific is compiled in: the API
# base URL is relative and Sentry reads PUBLIC_SENTRY_* at run time.
RUN pnpm run build --mode $NODE_ENV_ALIAS

# Plugin frontend bundles are not built here: the setting service builds and
# serves them (see app/setting/Dockerfile).

# Delete source code files that were used to build the app that are no longer needed
RUN rm -rf static/ emailTemplates/ docker-compose.yml

# Stamped by the release workflow. Without them /healthcheck reports 0.0.0-dev.
ARG IDAH_VERSION
ARG IDAH_GIT_SHA
ENV IDAH_VERSION="$IDAH_VERSION"
ENV IDAH_GIT_SHA="$IDAH_GIT_SHA"

# The USER instruction sets the user name to use as the default user for the remainder of the current stage
USER node:node

# This is the command that will be run inside the image when you tell Docker to start the container
CMD ["node","build/index.js"]