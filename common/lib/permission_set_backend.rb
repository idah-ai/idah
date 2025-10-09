# frozen_string_literal: true

class PermissionSetBackend < Verse::Service::Base
  use PermissionSetRepository

  def initialize(*)
    # We don't store the auth_context, we use a default auth context
    # instead (see below)
    super(Verse::Auth::Context.new)
  end

  def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
    filter.merge!({ assignable: true })

    repo.index(
      filter,
      included:,
      page:,
      items_per_page:,
      sort:,
      query_count:
    )
  end

  def fetch(permission_set_name)
    return [] unless permission_set_name

    permission_set = repo.find_by({ name: permission_set_name.to_s })

    raise Verse::Error::Authorization, "Permission set `#{permission_set_name}` not set" unless permission_set

    permission_set.rights
  end
end
