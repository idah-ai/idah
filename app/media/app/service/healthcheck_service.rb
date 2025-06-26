module HealthcheckService
  extend self

  Result = Data.define(:success?, :status)

  def run
    status = {}
    healthy = true

    if defined?(Verse::Sequel::Plugin)
      Verse::Plugin.all.lazy.select do |plugin|
        plugin.class < Verse::Sequel::Plugin
      end.each do |plugin|
        plugin.client do |db|
          db.execute("SELECT 1")
          status[plugin.name] = "OK"
        rescue StandardError => e
          healthy = false
          status[plugin.name] = "FAILED"
        end
      end
    end

    if defined?(Verse::Redis::Plugin)
      Verse::Plugin.all.lazy.select do |plugin|
        plugin.class < Verse::Redis::Plugin
      end.each do |plugin|
        plugin.with_client do |client|
          client.ping
          status[plugin.name] = "OK"
        rescue StandardError => e
          healthy = false
          status[plugin.name] = "FAILED"
        end
      end
    end

    return Result.new(
      success?: healthy,
      status: status
    )
  rescue RuntimeError => e
    Verse.logger&.error "Healthcheck failed: #{e.message}"

    return Result.new(
      success?: false,
      status: status
    )
  end


end
