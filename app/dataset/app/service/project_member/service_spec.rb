# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:entry_repo) { Entry::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(
      name: "Test Project",
      description: "A test project",
      created_by_email: "user@example.com",
      organization_id: 1
    )
  end

  let(:attributes) do
    {
      project_id: project_id,
      account_id: 1,
      email: "annotator@email.com",
      role: "annotator",
      invited_by_id: 1
    }
  end

  context "As Admin", as: :admin do
    subject { described_class.new(current_auth_context) }

    describe "#index" do
      it "returns all project members" do
        project_member_repo.create(attributes)
        project_member_repo.create(attributes.merge(email: "annotator2@email.com", account_id: 2))

        result = subject.index
        expect(result.count).to eq(2)
      end

      it "filters project members by project_id" do
        project_member_repo.create(attributes)

        another_project_id = project_repo.create(
          name: "Another Project",
          description: "Another test project",
          created_by_email: "user2@example.com",
          organization_id: 1
        )
        project_member_repo.create(attributes.merge(project_id: another_project_id, email: "annotator2@email.com"))

        result = subject.index({ project_id: project_id })
        expect(result.count).to eq(1)
        expect(result.first.project_id).to eq(project_id)
      end
    end

    describe "#create" do
      it "creates a new project member" do
        record = deserialize(
          {
            data: {
              type: "dataset:project_members",
              attributes: attributes,
              relationships: {
                project: {
                  data: {
                    type: "dataset:projects",
                    id: project_id
                  }
                }
              }
            }
          }
        )

        project_member = subject.create(record)
        expect(project_member.project_id).to eq(project_id)
        expect(project_member.account_id).to eq(1)
        expect(project_member.email).to eq("annotator@email.com")
        expect(project_member.role).to eq("annotator")
      end

      context "notifications" do
        before do
          expect_any_instance_of(ProjectMember::Repository).to receive(:after_commit).and_yield
          allow(Api[:idah].iam.accounts).to receive(:show).and_return(
            double(name: "Annotator User", email: "inviter@example.com", joined_at: Time.now)
          )
          allow(Service::Notification).to receive(:email)
        end

        it "sends notification email when account has joined" do
          record = deserialize(
            {
              data: {
                type: "dataset:project_members",
                attributes: attributes,
                relationships: {
                  project: {
                    data: {
                      type: "dataset:projects",
                      id: project_id
                    }
                  }
                }
              }
            }
          )

          subject.create(record)

          expect(Service::Notification).to have_received(:email).with(
            hash_including(
              to: "annotator@email.com",
              title: "You have been assigned to the project 'Test Project'",
              category: "project_member_added",
              project_name: "Test Project"
            )
          )
        end

        it "does not send notification email when account has not joined" do
          allow(Api[:idah].iam.accounts).to receive(:show).and_return(
            double(email: "inviter@example.com", joined_at: nil)
          )

          record = deserialize(
            {
              data: {
                type: "dataset:project_members",
                attributes: attributes,
                relationships: {
                  project: {
                    data: {
                      type: "dataset:projects",
                      id: project_id
                    }
                  }
                }
              }
            }
          )

          subject.create(record)

          expect(Service::Notification).not_to have_received(:email)
        end
      end
    end

    describe "#show" do
      it "shows a project member" do
        project_member_id = project_member_repo.create(attributes)

        found_project_member = subject.show(project_member_id)
        expect(found_project_member.id.to_s).to eq(project_member_id)
      end
    end

    describe "#update" do
      it "updates a project member" do
        project_member_id = project_member_repo.create(attributes)

        record = deserialize(
          {
            data: {
              type: "dataset:project_members",
              id: project_member_id,
              attributes: {
                role: "admin"
              }
            }
          }
        )

        subject.update(record)

        updated_project_member = project_member_repo.find!(project_member_id)
        expect(updated_project_member.role).to eq("admin")
      end
    end

    describe "#delete" do
      it "deletes a project member" do
        project_member_id = project_member_repo.create(attributes)

        subject.delete(project_member_id)

        member = project_member_repo.find(project_member_id)
        expect(member.disabled_at).not_to be_nil
      end

      context "notifications" do
        before do
          expect_any_instance_of(ProjectMember::Repository).to receive(:after_commit).and_yield
          allow(Service::Notification).to receive(:email)
        end

        it "sends notification email when project member is deleted" do
          project_member_id = project_member_repo.create(attributes)

          subject.delete(project_member_id)

          expect(Service::Notification).to have_received(:email).with(
            hash_including(
              to: "annotator@email.com",
              title: "You have been removed from the project 'Test Project'",
              category: "project_member_removed",
              project_name: "Test Project",
              remover_email: "admin@example.com",
              remover_name: "Admin User"
            )
          )
        end
      end
    end

    describe "#delete_account_members" do
      let(:account_id) { 123 }
      let(:another_account_id) { 456 }

      before do
        # Create another project
        @another_project_id = project_repo.create(
          name: "Another Project",
          description: "Another test project",
          created_by_email: "user@example.com",
          organization_id: 1
        )

        # Create project members for account 123
        @member1_id = project_member_repo.create(
          attributes.merge(account_id: account_id, email: "member1@email.com")
        )
        @member2_id = project_member_repo.create(
          attributes.merge(
            account_id: account_id,
            email: "member2@email.com",
            project_id: @another_project_id
          )
        )

        # Create project member for different account
        @other_account_member_id = project_member_repo.create(
          attributes.merge(account_id: another_account_id, email: "other@email.com")
        )
      end

      it "hard deletes all project members for the given account_id" do
        subject.delete_account_members(account_id)

        # Members for the specified account should be deleted
        expect { project_member_repo.find!(@member1_id) }.to raise_error(Verse::Error::NotFound)
        expect { project_member_repo.find!(@member2_id) }.to raise_error(Verse::Error::NotFound)

        # Members for other accounts should still exist
        expect(project_member_repo.find!(@other_account_member_id)).not_to be_nil
      end

      it "handles accounts with no project members" do
        expect { subject.delete_account_members(99_999) }.not_to raise_error
      end

      it "deletes members from multiple projects" do
        subject.delete_account_members(account_id)

        # Verify both members from different projects are deleted
        all_members = project_member_repo.index({})
        remaining_member_ids = all_members.map{ |m| m.id.to_s }

        expect(remaining_member_ids).not_to include(@member1_id)
        expect(remaining_member_ids).not_to include(@member2_id)
        expect(remaining_member_ids).to include(@other_account_member_id)
      end
    end

    describe "#disable_account_members" do
      let(:account_id) { 123 }
      let(:another_account_id) { 456 }

      before do
        @expected_time = Time.utc(2026, 1, 1, 0, 0, 0)

        # freeze the time
        allow(Time).to receive(:now).and_return(@expected_time)

        # Create another project
        @another_project_id = project_repo.create(
          name: "Another Project",
          description: "Another test project",
          created_by_email: "user@example.com",
          organization_id: 1
        )

        # Create project members for account 123
        @member1_id = project_member_repo.create(
          attributes.merge(account_id: account_id, email: "member1@email.com")
        )
        @member2_id = project_member_repo.create(
          attributes.merge(
            account_id: account_id,
            email: "member2@email.com",
            project_id: @another_project_id
          )
        )

        # Create project member for different account
        @other_account_member_id = project_member_repo.create(
          attributes.merge(account_id: another_account_id, email: "other@email.com")
        )
      end

      it "soft deletes all project members for the given account_id" do
        subject.disable_account_members(account_id)

        # Members for the specified account should be disabled
        member1 = project_member_repo.find!(@member1_id)
        member2 = project_member_repo.find!(@member2_id)

        expect(member1.disabled_at).to eq(@expected_time)
        expect(member2.disabled_at).to eq(@expected_time)

        # Members for other accounts should not be disabled
        other_member = project_member_repo.find!(@other_account_member_id)
        expect(other_member.disabled_at).to be_nil
      end

      it "handles accounts with no project members" do
        expect { subject.disable_account_members(99_999) }.not_to raise_error
      end

      it "disables members from multiple projects" do
        subject.disable_account_members(account_id)

        # Verify both members from different projects are disabled
        all_members = project_member_repo.index({})
        account_members = all_members.select { |m| m.account_id == account_id }
        other_members = all_members.reject { |m| m.account_id == account_id }

        expect(account_members.all? { |m| m.disabled_at == @expected_time }).to be true
        expect(other_members.all? { |m| m.disabled_at.nil? }).to be true
      end

      it "sets the same timestamp for all disabled members" do
        subject.disable_account_members(account_id)

        member1 = project_member_repo.find!(@member1_id)
        member2 = project_member_repo.find!(@member2_id)

        expect(member1.disabled_at).to eq(@expected_time)
        expect(member2.disabled_at).to eq(@expected_time)
      end
    end

    describe "#delete_account_members" do
      before do
        another_project_id = project_repo.create(
          name: "Another Project",
          description: "Another test project",
          created_by_email: "user@example.com",
          organization_id: 1
        )

        @project_member = subject.create(
          deserialize(
            {
              data: {
                type: "dataset:project_members",
                attributes: attributes,
                relationships: {
                  project: {
                    data: {
                      type: "dataset:projects",
                      id: project_id
                    }
                  }
                }
              }
            }
          )
        )
        @another_project_member = subject.create(
          deserialize(
            {
              data: {
                type: "dataset:project_members",
                attributes: attributes,
                relationships: {
                  project: {
                    data: {
                      type: "dataset:projects",
                      id: another_project_id
                    }
                  }
                }
              }
            }
          )
        )
      end

      it "deletes a nonparticipant project member if after the account is deleted" do
        subject.delete_account_members(1)

        expect { project_member_repo.find!(@project_member.id) }.to raise_error(Verse::Error::NotFound)
        expect { project_member_repo.find!(@another_project_member.id) }.to raise_error(Verse::Error::NotFound)
      end
    end
  end
end
