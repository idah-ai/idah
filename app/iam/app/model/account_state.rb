# frozen_string_literal: true

module AccountState
  class Record < Verse::Model::Record::Base
    type Resource::Iam::AccountStates

    field :id, type: Integer, primary: true

    field :account_id, type: Integer, readonly: true
    field :refresh_seq, type: Integer, visible: false
    field :nonce, type: Integer, visible: false

    belongs_to :account, repository: "Account::Repository", foreign_key: :account_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "account_states"
    self.resource = Resource::Iam::AccountStates

    def account_audit_repo
      @account_audit_repo ||= Account::AuditRepository.new(auth_context)
    end

    def check_seq(account_id, nonce, sequence)
      with_db_mode :r do |_db|
        frag = <<-SQL
          account_id = :account_id AND
          nonce = :nonce AND
          refresh_seq < :refresh_seq
        SQL

        !table.where(
          Sequel.lit(
            frag,
            account_id:,
            nonce:,
            refresh_seq: sequence + 30 # Use 30 seconds leeway in case the user is opening multiple tab at once.
          )
        ).empty?
      end
    end

    def bump_refresh_seq(account_id, role, nonce:, ip: "", at: Time.now)
      auth_context.mark_as_checked!

      with_db_mode :rw do
        transaction do
          at_ts = at.to_i

          state = table.where({ account_id: }).first

          is_login = state.nil? || state[:nonce] != nonce

          properties = { refresh_seq: at_ts }

          if is_login
            properties[:nonce] = nonce
          end

          if state
            table.where({ account_id: }).update(properties)
          else
            table.insert({ account_id:, **properties })
          end

          if is_login
            account_audit_repo.log_access(account_id, role, ip, at)
          end

          at_ts
        end
      end
    end
  end
end
