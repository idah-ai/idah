module Context
  module Idah
    IDAH_APIS = [
      ApiIdah::Iam::Organizations,
      ApiIdah::Dataset::Projects,
      ApiIdah::Dataset::ProjectMembers,
      ApiIdah::Dataset::Datasets,
      ApiIdah::Media::Medias,
      ApiIdah::Dataset::Entries,
      ApiIdah::Dataset::Annotations
    ].freeze

    def self.new(args = nil, context = nil, opts = nil)
      filters = (Hash(args).keys + Hash(context).keys).uniq

      Verse::logger.debug(filters: filters)
      # Validate that all IDAH_APIS are valid Context classes
      IDAH_APIS.each do |api_class|
        Verse::logger.debug(api_check: api_class)
        unless api_class < ApiIdah::Base
          raise Context::Error::InvalidContext, "#{api_class} is not a subclass of ApiIdah::Base"
        end
      end

      # Find the matching API based on filter keys, or initialize all APIs
      matched_api = IDAH_APIS.find do |idah_context|
        Verse::logger.debug(name: idah_context.name, filters: filters)
        filters.include?(idah_context.name)
      end

      Verse::logger.debug(matched_api: matched_api)
      context_api = if matched_api
                      matched_api.root_api(args, context, opts)
                    else
                      ApiIdah::Dataset::Datasets.new(args, filters, opts)
                    end

      # Ensure the root API is only ApiIdah::Dataset::Datasets
      unless context_api.is_a?(ApiIdah::Dataset::Datasets)
        raise Context::Error::InvalidContext, "Expected ApiIdah::Dataset::Datasets, got #{context_api.class}"
      end

      context_api
    end
  end
end
