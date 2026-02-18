# frozen_string_literal: true

module IdahImage
  module Processor
    class Image
      attr_reader :context

      def initialize(context)
        @context = context
      end

      def run
        raise StandardError, "Image processor not implemented"
      end
    end
  end
end
