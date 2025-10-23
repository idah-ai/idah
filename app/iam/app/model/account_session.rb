# frozen_string_literal: true

module AccountSession
  class Record < Verse::Model::Record::Base
    type Resource::Iam::AccountSessions

    field :id, type: Integer, primary: true

    field :account_id, type: Integer, readonly: true
    field :refresh_seq, type: Integer, visible: false
    field :nonce, type: Integer, visible: false

    field :user_agent, type: String
    field :ip, type: String

    belongs_to :account, repository: "Account::Repository", foreign_key: :account_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "account_sessions"
    self.resource = Resource::Iam::AccountSessions

    def account_login_audit_repo
      @account_login_audit_repo ||= AccountLoginAudit::Repository.new(auth_context)
    end

    def check_seq(account_id, session_id, nonce, sequence)
      with_db_mode :r do |_db|
        frag = <<-SQL
          account_id = :account_id AND
          id = :session_id AND
          nonce = :nonce AND
          refresh_seq < :refresh_seq
        SQL

        !table.where(
          Sequel.lit(
            frag,
            account_id:,
            session_id:,
            nonce:,
            refresh_seq: sequence + 30 # Use 30 seconds leeway in case the user is opening multiple tab at once.
          )
        ).empty?
      end
    end

    def bump_refresh_seq(account_id, role, nonce:, session_id: nil, ip: "", user_agent: nil, at: Time.now)
      auth_context.mark_as_checked!

      with_db_mode :rw do
        transaction do
          at_ts = at.to_i

          properties = { refresh_seq: at_ts, ip:, user_agent: user_agent || "" }

          session = table.where({ id: session_id, account_id: account_id }).first if session_id

          is_login = session_id.nil? || session.nil? || session[:nonce] != nonce

          properties[:nonce] = nonce if is_login

          if session
            table.where({ id: session_id, account_id: }).update(properties)
          else
            session_id = table.insert({ account_id:, **properties })
          end

          if is_login
            account_login_audit_repo.log_access(account_id, role, ip, user_agent, at)
          end

          [at_ts, session_id]
        end
      end
    end
  end
end
