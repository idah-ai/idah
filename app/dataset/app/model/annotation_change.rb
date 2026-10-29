# frozen_string_literal: true

module AnnotationChange
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::AnnotationChanges

    field :id, type: String, primary: true
    field :annotation_id, type: String, readonly: true
    field :entry_id, type: String, readonly: true
    field :project_id, type: String, readonly: true
    field :account_id, type: Integer, readonly: true
    field :op, type: String, readonly: true
    field :version, type: Integer, readonly: true
    field :changes, type: Array, readonly: true
    field :changed_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "annotation_changes"
    self.resource = Resource::Dataset::AnnotationChanges

    encoder :changes, Verse::Sequel::JsonEncoder

    # History visibility follows annotation visibility exactly: whatever rule
    # `Annotation::Repository#scoped(:read)` applies also applies to history.
    # Do not copy the annotation scoping conditions into this repository.
    #
    # `Annotation::Repository#scoped` is public on this repository (it redefines
    # the protected base method without a visibility modifier), so calling it
    # from here also marks the auth context as checked, which
    # CheckAuthenticationHandler requires on every exposed call.
    def scoped(action)
      unless action == :read
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end

      annotations = Annotation::Repository.new(auth_context)
      table.where(annotation_id: annotations.scoped(:read).select(:id))
    end
  end
end
