FROM ruby:3.4.3-alpine

RUN apk add --update --no-cache \
  build-base \
  postgresql-dev \
  tzdata \
  git \
  libxml2-dev \
  libxslt-dev \
  shared-mime-info \
  file \
  && rm -rf /var/cache/apk/*

ARG APP_ENVIRONMENT

ENV APP_ENVIRONMENT $APP_ENVIRONMENT
ENV LOCAL_APP_PATH ./app/v3/VERSE
ENV LOCAL_COMMON_PATH ./common

ENV APP_PATH /app/VERSE
ENV COMMON_PATH /app/common

ENV PORT 3000

COPY $LOCAL_COMMON_PATH $COMMON_PATH

RUN mkdir -p $APP_PATH
WORKDIR $APP_PATH

COPY $LOCAL_APP_PATH/Gemfile $LOCAL_APP_PATH/Gemfile.lock ./

RUN bundle config set force_ruby_platform true
RUN bundle config set --local without 'development test'
RUN bundle install --jobs 20 --retry 5

COPY $LOCAL_APP_PATH .

CMD ["bundle", "exec", "puma"]
