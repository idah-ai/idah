module Context
  module ContextApi
    APIS = [
      Iam::Organizations,
      Dataset::Projects,
      # Dataset::ProjectMembers,
      Dataset::Datasets,
      # Media::Medias,
      # Dataset::Entries,
      # Dataset::Annotations
    ].freeze

    def self.new(args = nil, context = nil, opts = nil)
      filters = (Hash(args).keys + Hash(context).keys).uniq

      Verse::logger.debug(filters:)
      # Validate that all APIS are valid Context classes
      APIS.each do |api_class|
        Verse::logger.debug(api_class:)
        unless api_class < Base
          raise Context::Error::InvalidContext, "#{api_class} is not a subclass of Base"
        end
      end

      # Find the matching API based on filter keys, or initialize all APIs
      matched_api = APIS.find do |idah_context|
        Verse::logger.debug(name: idah_context.name, filters:)
        filters.include?(idah_context.name)
      end

      Verse::logger.debug(matched_api: matched_api)
      delegated_obj = if matched_api
                      matched_api.root_api(args, context, opts)
                    else
                      Dataset::Datasets.new(args, context, opts)
                    end

      # Ensure the root API is only Dataset::Datasets
      unless delegated_obj.is_a?(Dataset::Datasets)
        raise Context::Error::InvalidContext, "Expected Dataset::Datasets, got #{delegated_obj.class}"
      end

      delegated_obj
    end
  end
end
