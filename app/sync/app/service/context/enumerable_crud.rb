module Context
  class EnumerableCrud < Crud
    DEFAULT_BATCH_SIZE = 100
    def index(**opts)
      # Verse::Util::Enumerator.chunked_enumerator(1) do |number|
      # might be more align to ruby Enumerator.new

      Verse::Util::Iterator.chunk_iterator(1) do |number|
        filter = build_filters(opts[:filter])
        built_opts = Hash(build_opts(opts.except(:filter)))
        size = Hash(built_opts[:page])[:size] || DEFAULT_BATCH_SIZE
        built_opts = built_opts.merge(page:{number:, size:})
        built_opts = built_opts.merge(filter:) if filter
        super(**built_opts)
      end
    end
  end
end
