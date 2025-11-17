# frozen_string_literal: true

module SpecData
  module RepositoryHelper
    def self.included(base)
      base.around do |example|
        Verse::Plugin[:sequel].client(:rw) do |db|
          db.transaction do
            db.rollback_on_exit
            example.run
          end
        end
      end
    end
  end
end
