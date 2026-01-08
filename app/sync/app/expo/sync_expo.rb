# frozen_string_literal: true

class SyncExpo < BaseExpo
  http_path "/"

  use_service Sync::Service

  expose on_http(:get, "export") do
    desc "export endpoint"
    input do
      field? :filter do
        field? :organizations do
          field? :id, String
          # field? :name, String
          # [
          #   # any flavored specific organizations attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :projects do
          field? :id, String
          # field? :name, String
          # field? :created_by_email, String
          # [
          #   # any flavored specific projects attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :project_members do
          field? :id, String
          # field? :name, String
          # field? :email, String
          # field? :role, String
          # field? :invited_by_id, String
          # [
          #   # any flavored specific project_members attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :datasets do
          field? :id, String
          # field? :project_id, String
          # field? :modality, String
          # field? :status, String
          # [
          #   # any flavored specific datasets attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :entries do
          field? :id, String
          # field? :wf_step, String
          # field? :status, String
          # field? :resource, String
          # field? :assigned_to_id, String
          # [
          #   # any flavored specific entries attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        # field? :annotations do
        #   field? :id, String
        #   # # field? :shape_type, String
        #   # [
        #   #   # any flavored specific annotations attributes
        #   # ].each do |attribute, type|
        #   #   field? attribute, type
        #   # end
        # end
        # [
        #   # any flavored specific record
        # ].each do |record|
        #   field? record do
        #     [
        #       # any flavored specific record attributes
        #     ].each do |attribute, type|
        #       field? attribute, type
        #     end
        #   end
        # end
      end
    end
  end
  def export
    service.export(params[:filter])
  end
end
