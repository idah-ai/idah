# frozen_string_literal: true

class Api
  class Service
    attr_reader :parent,
                :name,
                :expositions

    attr_accessor :base_path

    def initialize(parent, name)
      @parent = parent
      @name = name
      @base_path = ""
      @expositions = {}
    end

    def register(exposition_name, method_name, &block)
      expo = register_exposition(exposition_name)
      expo.register(method_name, &block)
    end

    def path(path = "")
      [
        parent.base_url,
        base_path,
        path
      ].reject(&:empty?).join("/")
    end

    private

    def register_exposition(exposition_name)
      @expositions.fetch(exposition_name) do
        exposition = Api::Exposition.new(parent, exposition_name)
        @expositions[exposition_name] = exposition

        define_singleton_method(exposition_name){ exposition }

        exposition
      end
    end
  end
end
