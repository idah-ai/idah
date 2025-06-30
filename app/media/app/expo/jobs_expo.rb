# frozen_string_literal: true

class JobsExpo < Verse::Exposition::Base
  http_path "/jobs"

  desc <<-MD
    # Jobs Expo

    This exposition provides access to the job records in the system.
    It allows you to view, delete, and signal jobs.
    You can also filter jobs by various attributes such as status, priority, and scheduled time.
  MD

  use_service Jobs::Service

  json_api Jobs::Record do
    # allowed_included "..."
    show
    delete
    index do
      allowed_filters :id__in,
                      :job_class__in,
                      :priority__gte,
                      :priority__lte,
                      :status__in,
                      :retry_count__gte,
                      :retry_count__lte,
                      :scheduled_at__gte,
                      :scheduled_at__lte,
                      :created_at__gte,
                      :created_at__lte,
                      :updated_at__gte,
                      :updated_at__lte

      blacklist_filters :arguments
    end
  end

  expose on_resource_event("medias:jobs", "created") do
    desc "When a job is created, signal the scheduler to wake up"
    "and try to process it."
  end
  def signal
    Jobs::Scheduler.instance.signal
  end
end
