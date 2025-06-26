RSpec.describe Job, database: true do

  describe Job::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    let!(:job_creator) do
      lambda do |status: "pending", priority: 0, scheduled_at: Time.now|
        id = subject.create(
          job_class: "JobClass",
          arguments: {},
          status: status,
          priority: priority,
          scheduled_at: scheduled_at,
          retry_count: 0
        )
        subject.find!(id)
      end
    end

    context "#lock_available" do
      it "should only lock pending jobs" do
        job1 = job_creator.call(status: "pending")
        job2 = job_creator.call(status: "done")

        jobs = subject.lock_available(2)

        expect(jobs.map(&:id)).to eq([job1.id])
      end

      it "should not lock job scheduled in the future" do
        job1 = job_creator.call(scheduled_at: Time.now + 3600)
        job2 = job_creator.call(scheduled_at: Time.now - 3600)

        jobs = subject.lock_available(2)

        expect(jobs.map(&:id)).to eq([job2.id])
      end

      it "should order by priority" do
        job1 = job_creator.call(priority: 0)
        job2 = job_creator.call(priority: 10)
        job3 = job_creator.call(priority: 5)

        jobs = subject.lock_available(3)

        expect(jobs.map(&:id)).to eq([job2.id, job3.id, job1.id])
      end

      it "should lock up to count jobs" do
        job1 = job_creator.call()
        job2 = job_creator.call()

        jobs = subject.lock_available(1)

        expect(jobs.size).to eq(1)
      end

      it "should update status to scheduled" do
        job1 = job_creator.call()

        jobs = subject.lock_available(1)

        expect(jobs.first.id).to eq(job1.id)

        job1_updated = subject.find!(job1.id)
        expect(job1_updated.status).to eq("scheduled")
      end
    end
  end
end
