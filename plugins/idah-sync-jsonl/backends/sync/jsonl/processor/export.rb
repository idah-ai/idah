module Jsonl
  module Processor
    class Export
      def initialize(context)
        @context = context
      end

      def run
        File.open([@context.name, :jsonl].join("."), "w") do |file|
          process { |line| file.puts line.to_json }
        end
      end

      private

      def process(&block)
        @context.datasets.each do |dataset_context|
          yield dataset_context.dataset
          dataset_context.entries.each do |entry_context|
            yield entry_context.media_info
            # file = Tempfile.new(entry_context.entry[:attributes][:resource])
            # file.write(entry_context.media_file)
            # file.close
            # yield file base64 ?
            # file.unlink
            yield entry_context.entry
            entry_context.annotations.each do |annotation_context|
              yield annotation_context.annotation
            end
          end
        end
      end
    end
  end
end