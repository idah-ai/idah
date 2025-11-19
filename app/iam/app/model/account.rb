# frozen_string_literal: true

module Account
  class Record < Verse::Model::Record::Base
    type Resource::Iam::Accounts

    field :id, type: Integer, primary: true

    field :name, type: String
    field :email, type: String, readonly: true

    field :hashed_password, type: [String, NilClass], visible: false, readonly: true
    field :sso_channel, type: [String, NilClass], readonly: true

    field :enabled, type: [TrueClass]
    field :role_name, type: [String, NilClass]
    field :role_scope, type: Hash

    field :picture_url, type: [String, NilClass], readonly: true

    field :joined_at, type: [Time, NilClass], readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    def password_match?(password)
      return false unless hashed_password

      BCrypt::Password.new(hashed_password) == password
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "accounts"
    self.resource = Resource::Iam::Accounts

    custom_filter :with_role_scope do |collection, role_scope|
      role_scope = role_scope.to_json unless role_scope.is_a?(String)

      collection.where(Sequel.lit("role_scope @> ?", role_scope))
    end

    def login(email, password)
      account = scoped(:login).where(email:).first

      # To prevent timing attack, add small delay when account is not found.
      if account
        account = decode(account)
        account = self.class.model_class.new(account)
        valid = account.password_match?(password)
      else
        sleep(rand(0.3..0.5))
        valid = false
      end

      valid ? account : nil
    end
  end
end
