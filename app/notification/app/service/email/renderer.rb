# frozen_string_literal: true

module Email
  class Renderer
    TEMPLATE_PATH = "#{__dir__}/templates".freeze

    attr_reader :account, :notification

    def initialize(account, notification)
      @account = account
      @notification = notification
    end

    def render(type)
      pattern_list = ["default", notification.category.to_s]

      while pattern = pattern_list.pop
        content = ::File.join(TEMPLATE_PATH, "#{pattern}.#{type}.erb")
        header = ::File.join(TEMPLATE_PATH, "partials/header.#{type}.erb")
        footer = ::File.join(TEMPLATE_PATH, "partials/footer.#{type}.erb")

        next unless ::File.exist?(content)

        content_template = ERB.new(::File.read(content)).result(binding)
        header_template = ERB.new(::File.read(header)).result(binding)
        footer_template = ERB.new(::File.read(footer)).result(binding)

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
  end
end
