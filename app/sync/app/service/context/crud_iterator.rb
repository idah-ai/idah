module Context
  class CrudIterator < Crud
    # Returns a lazy enumerator of records
    # For Delegate contexts: delegates directly
    # For API contexts: paginates through results automatically
    def index(filters = {}, **opts)
      Verse::logger.debug {[
        caller.take(25).join("\n"),
        {
          delegated: !!Hash(opts)[:delegated],
          context_api: @context_api.class,
          opts:, filters:
        }
      ].join("\n")}


      if (delegated)
        super(filters, opts.merge(delegate: true))
      else
        raise :stop if opts[:delegate]
        Verse::Util::Iterator.chunk_iterator(1) do |number|
          super(
            filters,
            page: { number:, size: @opts[:page_size] || DEFAULT_BATCH_SIZE }
          )
        end.lazy.map(&:data)
      end.map do |record|
        @context_builder&.call(record) || builder(record)
      end
    end
  end
end
