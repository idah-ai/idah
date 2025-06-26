RSpec.describe Jobs, database: true do
  describe Jobs::Repository do
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

    context "#next_scheduled_time" do
      it "should return nil if no pending jobs" do
        job_creator.call(status: "done")
        expect(subject.next_scheduled_time).to be_nil
      end

      it "should return the minimum scheduled_at time" do
        time = Time.now
        job1 = job_creator.call(scheduled_at: time + 100)
        job2 = job_creator.call(scheduled_at: time + 200)

        expect(subject.next_scheduled_time.to_i).to eq((time+100).to_i)
      end

      it "should not consider non-pending jobs" do
        time = Time.now
        job1 = job_creator.call(scheduled_at: time + 100, status: "done")
        job2 = job_creator.call(scheduled_at: time + 200)

        expect(subject.next_scheduled_time.to_i).to eq((time+200).to_i)
      end
    end
  end
end
