# frozen_string_literal: true

module RefreshToken
  extend self

  def encode(account_id, nonce, seq_id, exp: Time.now.to_i + 3600)
    JWT.encode(
      { uid: account_id, nc: nonce, refid: seq_id, sub: "ort", exp: },
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
      { algorithm: Verse::Http::Auth::Token.sign_algorithm, sub: "ort", verify_sub: true }
    )

    if account_states.check_seq(payload["uid"], payload["nc"], payload["refid"])
      return payload["uid"], payload["nc"]
    end

    raise BadRefreshTokenError, "bad uid/refid"
  rescue JWT::DecodeError
    raise BadRefreshTokenError, "Invalid JWT token"
  end

  protected

  def account_states
    @account_states ||= AccountState::Repository.new(Verse::Auth::Context[:system])
  end
end
