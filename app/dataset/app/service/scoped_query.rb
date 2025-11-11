# frozen_string_literal: true

module ScopedQuery
  module_function

  # Actions          | Roles
  # read             | project_owner, annotator, reviewer
  # update/delete    | project_owner
  # create           | N/A
  # 
  # Info:
  # Only org_owner and admin roles can create projects
  # Only project_owner(member), org_owner and admin roles can update and delete projects
  # Annotators and reviewers can only read projects
  def projects(table, action, account_id)
    case action
    when :read
      project_member_scoped_query(
        table, account_id, %w[project_owner annotator reviewer], foreign_key: :id
    )
    when :update, :delete
      project_member_scoped_query(
        table, account_id, %w[project_owner], foreign_key: :id
      )
    else
      raise_permission_denied!(action, :projects)
    end
  end

  # Actions                      | Roles
  # read, create, update, delete | project_owner
  # 
  # Info:
  # Only allowed for project_owner(member), org_owner and admin roles
  def project_members(table, action, account_id)
    case action
    when :read, :create, :update, :delete
      project_member_scoped_query(
        table,
        account_id,
        %w[project_owner],
      )
    else
      raise_permission_denied!(action, :datasets)
    end
  end

  # Actions                | Roles
  # read                   | project_owner, annotator, reviewer
  # create, update, delete | project_owner
  # 
  # Info:
  # Only project_owner(member), org_owner and admin roles can create, update and delete datasets
  # Annotators and reviewers can only read datasets
  def datasets(table, action, account_id)
    case action
    when :read
      project_member_scoped_query(
        table,
        account_id,
        %w[project_owner annotator reviewer],
        foreign_key: :project_id
      )
    when :create, :update, :delete
      project_member_scoped_query(
        table,
        account_id,
        %w[project_owner],
      )
    else
      raise_permission_denied!(action, :datasets)
    end
  end

  def project_member_scoped_query(table, account_id, roles, foreign_key: :project_id)
    scoped_fragment = <<-SQL
      EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.account_id = :account_id
          AND pm.project_id = :main_table.:foreign_key
          AND pm.role IN :roles
      )
    SQL

    table.where(
      Sequel.lit(
        scoped_fragment,
        account_id:,
        roles:,
        main_table: table.first_source_table.to_sym,
        foreign_key:
      )
    )
  end

  def raise_permission_denied!(action, target)
    raise Verse::Error::Unauthorized, "Permission denied for \"#{action}\" action on #{target}"
  end
end