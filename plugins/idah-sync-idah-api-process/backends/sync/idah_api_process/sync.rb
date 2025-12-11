module IdahApiProcess
  class Sync
    def initialize(context)
      @context = context
      @file = nil
    end


    def start(&block)
      yield { |s| Verse::logger.info { [:todo, :process, self, s].join(" ") } }
    end

    def on_init(&block)
      yield 'on_init'
    end

    def on_dataset(dataset_context, &block)
      yield dataset_context.dataset
    end

    def on_entry(entry_context, &block)
      yield entry_context.media_info
      # file = Tempfile.new(entry_context.entry[:attributes][:resource])
      # file.write(entry_context.media_file)
      # file.close
      # yield file base64 ?
      # file.unlink
      yield entry_context.entry
    end

    def on_annotation(annotation_context, &block)
      yield annotation_context.annotation
    end

    def on_close
      # ?
    end

    def run
      File.open([@context.name, :jsonl].join("."), "w") do |file|
        process { |line| file.puts line.to_json }

        [@context.name, :jsonl].join(".")
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