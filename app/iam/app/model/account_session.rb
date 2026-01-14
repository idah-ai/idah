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

    event(name: "logged_out")
    def logout(session_id)
      session = find!(session_id)

      return unless session

      add_metadata(actor_account_id: session.account_id)

      no_event do
        delete(session_id)
      end
    end

    def check_seq(account_id, session_id, nonce, sequence)
      with_db_mode :rw do |_db|
        new_sequence = sequence + 30
        updated = table
                  .with_sql(<<~SQL, account_id:, session_id:, nonce:, refresh_seq: new_sequence)
                    UPDATE account_sessions
                    SET refresh_seq = :refresh_seq
                    WHERE account_id = :account_id
                      AND id = :session_id
                      AND nonce = :nonce
                      AND refresh_seq < :refresh_seq
                    RETURNING id
                  SQL
                  .first

        !!updated
      end
    end

    def bump_refresh_seq(account, nonce:, session_id: nil, ip: "", user_agent: nil, at: Time.now)
      auth_context.mark_as_checked!

      with_db_mode :rw do
        transaction do
          at_ts = at.to_i

          properties = { refresh_seq: at_ts, ip:, user_agent: user_agent }

          session = table.where({ id: session_id, account_id: account.id }).first if session_id

          is_login = session_id.nil? || session.nil? || session[:nonce] != nonce

          properties[:nonce] = nonce

          if session
            table.where({ id: session_id, account_id: account.id }).update(properties)
          else
            session_id = table.insert({ account_id: account.id, **properties })
          end

          if is_login
            Verse.publish(
              "iam:account:login",
              {
                account_id: account.id,
                account_email: account.email,
                account_role: account.role_name,
                ip: ip,
                user_agent: user_agent,
                at: at,
              }
            )
          end

          [at_ts, session_id]
        end
      end
    end
  end
end
