# frozen_string_literal: true

require "sinatra/cookies"

Verse::Http::Server.helpers(Sinatra::Cookies)
