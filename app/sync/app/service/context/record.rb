module Context
  class Record < Delegate
    def initialize(record, relations = nil)
      @record = record
      @relations = relations
      @root_relations = Root.new(relations)
      super(self.class.name, ->_filters{[record]})
    end

    def method_missing(name, *args, &block)
      Verse::logger::debug{"#{[self.class.name, :method_missing].join("#")}(name(#{name}), args(#{args}))"}

      if record_respond_to_missing(name)
        Verse::logger::debug{:record_respond_to_missing}
        @record.send(name, *args, &block)
      elsif root_relations_respond_to_missing(name)
        Verse::logger::debug{:root_relations_respond_to_missing}
        @root_relations.send(name, *args, &block)
      # else
      #   super
      end
    end

    def record_respond_to_missing(name, include_private = false)
      Verse::logger::debug{"#{
          [self.class.name, :record_respond_to_missing].join("#")
        }(name(#{name}), include_private(#{include_private}))
        #{{
          relations_respond: @relations.map(&:name).include?(name),
          record_respond: @record.respond_to?(name, include_private),
          respond: @relations.map(&:name).include?(name) ? :relations : @record.respond_to?(name, include_private) ? :record : :none
        }}"
      }
      response = !@relations.map(&:name).include?(name) &&
        @record.respond_to?(name, include_private)
      Verse::logger::debug{{response:}}
      response
    end

    def root_relations_respond_to_missing(name, include_private = false)
      Verse::logger::debug{"#{[self.class.name, :root_relations_respond_to_missing].join("#")}(name(#{name}), include_private(#{include_private}))"}
      response = @root_relations.respond_to?(name, include_private) || false
      Verse::logger::debug{{response:}}
      response
    end

    def respond_to_missing?(name, include_private = false)
      Verse::logger::debug{"#{[self.class.name, :respond_to_missing].join("#")}(name(#{name}), include_private(#{include_private}))"}

      record_respond_to_missing(name, include_private) ||
        root_relations_respond_to_missing(name, include_private) ||
        super
    end
  end
end