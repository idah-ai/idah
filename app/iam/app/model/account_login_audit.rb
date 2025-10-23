# frozen_string_literal: true

module AccountLoginAudit
  class Record < Verse::Model::Record::Base
    type Resource::Iam::AccountLoginAudits

    field :id, type: Integer, primary: true
    field :account_id, type: Integer, visible: false

    field :role, type: String
    field :logged_in_at, type: Time

    field :ip, type: Hash
    field :user_agent, type: String

    belongs_to :account, repository: "Account::Repository", foreign_key: :account_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "account_login_audits"
    self.resource = Resource::Iam::AccountLoginAudits

    def log_access(account_id, role, ip, user_agent, at)
      # no events
      table.insert(
        account_id:,
        logged_in_at: at,
        ip:,
        user_agent:,
        role:
      )
    end
  end
end
