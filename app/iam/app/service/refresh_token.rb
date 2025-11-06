# frozen_string_literal: true

module RefreshToken
  extend self

  def encode(account_id, session_id, nonce, seq_id, exp: Time.now.to_i + 3600)
    JWT.encode(
      { uid: account_id, sid: session_id, nc: nonce, refid: seq_id, sub: "ort", exp: },
      Verse::Http::Auth::Token.sign_key,
      Verse::Http::Auth::Token.sign_algorithm
    )
  end

  # Check the token,return BadRefreshTokenError if invalid,
  # returns the account id otherwise.
  def validate(token)
    payload, = JWT.decode(
      token,
      Verse::Http::Auth::Token.sign_key,
      true,
      {
        algorithm: Verse::Http::Auth::Token.sign_algorithm,
        sub: "ort",
        verify_sub: true
      }
    )

    uid   = payload["uid"]
    sid   = payload["sid"]
    nonce = payload["nc"]
    refid = payload["refid"]

    if account_sessions.check_seq(uid, sid, nonce, refid)
      return uid, sid, nonce
    end

    account_sessions.delete(sid)
    raise BadRefreshTokenError, "Bad uid/refid"
  rescue JWT::DecodeError
    raise BadRefreshTokenError, "Invalid JWT token"
  end

  protected

  def account_sessions
    @account_sessions ||= AccountSession::Repository.new(Verse::Auth::Context[:system])
  end
end
