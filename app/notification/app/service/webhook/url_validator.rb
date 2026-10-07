# frozen_string_literal: true

require "ipaddr"
require "resolv"

module Webhook
  # Rejects webhook URLs that aren't http(s) or that resolve to a non-public
  # address (loopback, link-local incl. cloud metadata, private, unspecified),
  # so webhooks can't reach internal services.
  module UrlValidator
    extend self

    def validate!(url)
      uri = URI.parse(url.to_s)
      invalid!("must be an http or https URL") unless uri.is_a?(URI::HTTP) && !uri.hostname.to_s.empty?

      addresses = Resolv.getaddresses(uri.hostname)
      invalid!("host `#{uri.hostname}` cannot be resolved") if addresses.empty?

      addresses.each do |address|
        invalid!("host `#{uri.hostname}` resolves to a non-public address (#{address})") unless public?(address)
      end
    rescue URI::InvalidURIError
      invalid!("is not a valid URL")
    end

    private

    def public?(address)
      ip = IPAddr.new(address).native # unwrap IPv4-mapped IPv6 (::ffff:10.0.0.1)

      !(ip.loopback? || ip.link_local? || ip.private? || ip.to_i.zero?)
    end

    def invalid!(message)
      raise Verse::Error::ValidationFailed, "url #{message}"
    end
  end
end
