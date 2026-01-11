module Context
  module Error
    class Base < StandardError; end

    class NotFound < Base
      def initialize(resource = nil)
        super(resource ? "Resource not found: #{resource}" : "Resource not found")
      end
    end

    class QueryFailed < Base
      def initialize(errors)
        super("Query failed: #{errors.inspect}")
      end
    end

    class Forbidden < Base
      def initialize(message)
        super("Access forbidden: #{message}")
      end
    end

    class InvalidData < Base
      def initialize(message)
        super("Invalid data: #{message}")
      end
    end

    class InvalidContext < Base
      def initialize(context_class)
        super("Invalid context class: #{context_class}")
      end
    end
  end
end