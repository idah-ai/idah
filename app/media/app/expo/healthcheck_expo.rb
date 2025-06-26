  class HealthcheckExpo < Verse::Exposition::Base
    http_path "/healthcheck"

    expose on_http(:get, "", auth: nil, renderer: Verse::Http::Renderer::Identity) do
      desc <<-MD
        Health check endpoint.

        Returns the status of dependencies such as Redis and PostgreSQL.
        If any dependency is down, it returns a failure status
        with a message indicating the issue,
        and sets the response status to 500.
      MD
      meta nodoc: true
    end
    def healthcheck
      output HealthcheckService.run

      server.response.status = 500 unless output.success?

      output.status
    end

    # Need verse-periodic gem.
    if respond_to?(:on_schedule)
      # Every day at 1.17am, run a memory maintenance task and compact the memory.
      # This run on each service instance.
      expose on_schedule("17 1 * * *", per_service: false)
      def mem_maintenance
        GC.start
        GC.compact
      end
    end
  end