# frozen_string_literal: true

class RoleBackend < Verse::Service::Base
  use RoleRepository

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

  # Role using compounded system
  def compound_role(main, sub_rights)
    main_role = repo.find_by({ name: main.to_s })

    rights = main_role.rights.dup

    sub_rights = sub_rights.map do |scope|
      role = repo.find_by({ name: "#{main}/#{scope}" })

      next role if role

      raise Verse::Error::Authorization, "Role `#{main}/#{scope}` not set"
    end

    # Sort the sub_rights by mask:
    rights = sub_rights
              .sort_by(&:mask)
              .map(&:rights)
              .sum(rights)

    # Remove the duplicated actions, assuming that the last action has the proper scope:
    rights.reverse.uniq { |right| right.split(".", 2).first }
  end

  def fetch(rolename)
    if rolename =~ /:/
      main, sub_rights = rolename.split(":")
      sub_rights = sub_rights.split(",")

      return compound_role(main, sub_rights)
    end

    role = repo.find_by({ name: rolename.to_s })

    raise Verse::Error::Authorization, "Role `#{rolename}` not set" unless role

    role.rights
  end
end
