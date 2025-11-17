# frozen_string_literal: true

module ScopedQuery
  module Service
    module_function

    def with_project_access?(account_id, project_id, roles)
      member_repo = ProjectMember::Repository.new(Verse::Auth::Context[:system])

      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = :project_id
            AND pm.role IN :roles
        )
      SQL

      member_repo.table.where(
        Sequel.lit(
          scoped_fragment,
          account_id:,
          project_id:,
          roles:
        )
      ).limit(1).any?
    end
  end
end
