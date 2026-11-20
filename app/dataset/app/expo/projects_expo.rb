# frozen_string_literal: true

class ProjectsExpo < BaseExpo
  http_path "/projects"

  use_service Project::Service

  desc <<~MD
    Projects organize datasets and team members
    for collaborative data annotation work.
  MD

  expose on_http(:get, "/:id/category_counts") do
    desc "Annotation totals by category ID and label across a Project's Datasets"
    input do
      field :id, String
      field? :filter, Hash, default: {}
    end
    output Verse::JsonApi::Util.jsonapi_collection(ProjectCategoryTotal::Record)
  end
  def category_counts
    service.category_counts(params[:id], params[:filter])
  end

  json_api Project::Record do
    show
    index do
      allowed_filters :created_by_email__match,
                      :created_at__gte,
                      :created_at__lte,
                      :organization_id,
                      :organization_id__in,
                      :updated_at__gte,
                      :updated_at__lte,
                      :name__match
    end

    create
    update
    delete
  end
end
