# frozen_string_literal: true

module AccountAudit
  class Record < Verse::Model::Record::Base
    type Resource::Iam::AccountAudits

    field :id, type: Integer, primary: true
    field :account_id, type: Integer, visible: false

    field :role, type: String
    field :logged_in_at, type: Time
    field :ip, type: Hash

    field :platform, type: String
    field :user_agent, type: String

    belongs_to :account, repository: "Account::Repository", foreign_key: :account_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "account_audits"
    self.resource = Resource::Iam::AccountAudits

    def last_login_role_for(account_id)
      scoped(:read).where(account_id:).order(Sequel.lit("date DESC")).get(:role)
    end

    def log_access(account_id, role, ip, platform, user_agent, at)
      # no events
      table.insert(
        account_id:,
        logged_in_at: at,
        ip:,
        platform:,
        user_agent:,
        role:
      )
    end
  end
end
