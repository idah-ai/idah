# frozen_string_literal: true

# Maps a plugin file/asset extension to a safe Content-Type. Used by the
# plugins expo to set an explicit content type (instead of relying on MIME
# sniffing) on both the file and asset responses.
module PluginMimeType
  TYPES = {
    ".js" => "text/javascript",
    ".css" => "text/css",
    ".json" => "application/json",
    ".png" => "image/png",
    ".jpg" => "image/jpeg",
    ".jpeg" => "image/jpeg",
    ".gif" => "image/gif",
    ".svg" => "image/svg+xml",
    ".webp" => "image/webp",
    ".woff" => "font/woff",
    ".woff2" => "font/woff2"
  }.freeze

  DEFAULT = "application/octet-stream"

  def self.for(filename)
    TYPES.fetch(File.extname(filename.to_s).downcase, DEFAULT)
  end
end
