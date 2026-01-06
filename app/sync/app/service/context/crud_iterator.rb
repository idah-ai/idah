module Context
  class CrudIterator < Crud
    DEFAULT_BATCH_SIZE = 100
    def index(filters = nil, opts = nil)
      # Verse::Util::Enumerator.chunked_enumerator(1) do |number|
      # might be more align to ruby Enumerator.new
      Verse::Util::Iterator.chunk_iterator(1) do |number|
        super(
          filters,
          page: { number:, size: Hash(@opts)[:page_size] || Hash(opts)[:page_size] || DEFAULT_BATCH_SIZE }
        )
      end
    end
  end
end
