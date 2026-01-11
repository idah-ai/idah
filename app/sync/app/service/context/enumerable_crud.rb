module Context
  class EnumerableCrud < Crud
    DEFAULT_BATCH_SIZE = 50
    def index(**opts)
      filter = build_filters(opts[:filter])
      built_opts = Hash(build_opts(opts.except(:filter))).merge(filter:)
      size = Hash(built_opts[:page])[:size] || DEFAULT_BATCH_SIZE
      # Verse::Util::Enumerator.chunked_enumerator(1) do |number|
      # might be more align to ruby Enumerator.new
      Verse::Util::Iterator.chunk_iterator(1) do |number|
        super(**built_opts.merge(page:{number:, size:}))
      end
    end
  end
end
