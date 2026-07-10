# frozen_string_literal: true

require "erubi"

module Email
  class Renderer
    TEMPLATE_PATH = "#{__dir__}/templates".freeze

    attr_reader :account, :notification

    def initialize(account, notification)
      @account = account
      @notification = notification
    end

    def render(type)
      # HTML output is auto-escaped to prevent stored XSS from user-controlled fields
      # (e.g. project/organization names flowing into notification.title). Text parts are
      # left unescaped so plaintext URLs are not mangled.
      escape = type == "html"
      pattern_list = ["default", notification.category.to_s]

      while pattern = pattern_list.pop
        content = ::File.join(TEMPLATE_PATH, "#{pattern}.#{type}.erb")
        header = ::File.join(TEMPLATE_PATH, "partials/header.#{type}.erb")
        footer = ::File.join(TEMPLATE_PATH, "partials/footer.#{type}.erb")

        next unless ::File.exist?(content)

        header_template = render_template(header, escape)
        content_template = render_template(content, escape)
        footer_template = render_template(footer, escape)

        return "#{header_template}#{content_template}#{footer_template}"
      end

      raise "No template found for #{notification.category}"
    end

    def render_text
      render("text")
    end

    def render_html
      render("html")
    end

    private

    def render_template(path, escape)
      src = ::Erubi::Engine.new(::File.read(path), escape: escape, trim: false).src
      eval(src, binding, path) # rubocop:disable Security/Eval
    end
  end
end
