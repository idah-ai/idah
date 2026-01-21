require "spec_helper"

RSpec.describe Context::Delegated do
  let(:delegate_mock) { double("Delegate", name: :test_delegate) }

  describe "inheritance" do
    it "inherits from Context::Crud" do
      expect(described_class.ancestors).to include(Context::Crud)
    end
  end

  describe "#initialize" do
    context "with name parameter" do
      it "uses provided name" do
        instance = described_class.new(delegate_mock, :custom_name)

        expect(instance.name).to eq(:custom_name)
      end

      it "stores the name in instance variable" do
        instance = described_class.new(delegate_mock, :my_resource)

        expect(instance.instance_variable_get(:@name)).to eq(:my_resource)
      end
    end

    context "without name parameter (nil)" do
      context "when delegate responds to name" do
        it "uses delegate's name" do
          instance = described_class.new(delegate_mock, nil)

          expect(instance.name).to eq(:test_delegate)
        end
      end

      context "when delegate doesn't respond to name" do
        let(:nameless_delegate) { double("Nameless") }

        it "uses nil as name" do
          instance = described_class.new(nameless_delegate, nil)

          expect(instance.instance_variable_get(:@name)).to be_nil
        end

        it "falls back to class name when calling name method" do
          instance = described_class.new(nameless_delegate, nil)

          # Should fall back to Context::Crud's name method (delegated)
          expect(instance.name).to eq(:delegated)
        end
      end
    end

    it "passes delegate to super (Context::Crud)" do
      instance = described_class.new(delegate_mock, :test)

      expect(instance.send(:__getobj__)).to eq(delegate_mock)
    end

    it "passes args to super" do
      args = { test: { id: "123" } }
      instance = described_class.new(delegate_mock, :test, args)

      expect(instance.instance_variable_get(:@args)).to eq(args)
    end

    it "passes context_args to super" do
      context_args = { parent: { org_id: "org-456" } }
      instance = described_class.new(delegate_mock, :test, nil, context_args)

      expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
    end

    it "passes opts to super" do
      opts = { page: { size: 100 } }
      instance = described_class.new(delegate_mock, :test, nil, nil, **opts)

      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end

    it "handles all parameters together" do
      args = { test: { filter: "active" } }
      context_args = { parent: { id: "parent-1" } }
      opts = { timeout: 30 }

      instance = described_class.new(delegate_mock, :custom, args, context_args, **opts)

      expect(instance.name).to eq(:custom)
      expect(instance.instance_variable_get(:@args)).to eq(args)
      expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end
  end

  describe "#name" do
    it "returns @name when set" do
      instance = described_class.new(delegate_mock, :explicit_name)

      expect(instance.name).to eq(:explicit_name)
    end

    it "delegates to super when @name is nil" do
      allow(delegate_mock).to receive(:name).and_return(:delegated_name)
      instance = described_class.new(delegate_mock, nil)

      expect(instance.name).to eq(:delegated_name)
    end

    it "prioritizes @name over delegate's name" do
      instance = described_class.new(delegate_mock, :override_name)

      # Even though delegate has name :test_delegate
      expect(instance.name).to eq(:override_name)
    end
  end

  describe "integration with Context::Crud" do
    let(:api_mock) { double("Api", name: :api) }
    let(:instance) { described_class.new(api_mock, :resources) }

    before do
      allow(api_mock).to receive(:index).and_return([{ id: "1" }])
      allow(instance).to receive(:builder).and_return([{ id: "1" }])
    end

    it "inherits index method" do
      result = instance.index

      expect(api_mock).to have_received(:index)
    end

    it "uses custom name for context operations" do
      filters = instance.build_filters({ status: "active" })

      # When building filters, it should use the name :resources
      # not :api (from delegate)
      expect(instance.name).to eq(:resources)
    end
  end

  describe "real-world usage scenarios" do
    context "wrapping a proc with a custom name" do
      let(:data_proc) { proc { [{ id: "1" }, { id: "2" }] } }

      it "allows naming a proc-based resource" do
        instance = described_class.new(data_proc, :custom_datasets)

        expect(instance.name).to eq(:custom_datasets)
        expect(instance.send(:__getobj__)).to eq(data_proc)
      end
    end

    context "creating a named wrapper around API" do
      let(:projects_api) { double("ProjectsApi", name: :projects) }

      it "can create custom named wrappers" do
        # Create a wrapper with a different name than the API
        archived_projects = described_class.new(
          projects_api,
          :archived_projects,
          { archived_projects: { status: "archived" } }
        )

        expect(archived_projects.name).to eq(:archived_projects)
        filters = archived_projects.build_filters
        expect(filters).to include(status: "archived")
      end
    end

    context "chaining delegated contexts" do
      let(:org_api) { double("OrganizationsApi", name: :organizations) }
      let(:org_context) do
        described_class.new(
          org_api,
          :my_orgs,
          { my_orgs: { user_id: "user-123" } }
        )
      end

      it "maintains custom name through context operations" do
        expect(org_context.name).to eq(:my_orgs)

        # Build context args should work with custom name
        context = org_context.build_context_args
        expect(context).to include(my_orgs: { user_id: "user-123" })
      end
    end
  end

  describe "edge cases" do
    context "with empty string name" do
      it "uses empty string as name" do
        instance = described_class.new(delegate_mock, "")

        expect(instance.instance_variable_get(:@name)).to eq("")
      end
    end

    context "with symbol name" do
      it "accepts symbol name" do
        instance = described_class.new(delegate_mock, :symbol_name)

        expect(instance.name).to eq(:symbol_name)
      end
    end

    context "with string name" do
      it "accepts string name" do
        instance = described_class.new(delegate_mock, "string_name")

        expect(instance.name).to eq("string_name")
      end
    end

    context "when delegate is nil" do
      it "accepts nil delegate" do
        instance = described_class.new(nil, :test_name)

        expect(instance.send(:__getobj__)).to be_nil
        expect(instance.name).to eq(:test_name)
      end
    end
  end

  describe "parameter order variations" do
    it "works with positional parameters" do
      instance = described_class.new(
        delegate_mock,
        :name,
        { test: { id: "1" } },
        { parent: { id: "2" } }
      )

      expect(instance.name).to eq(:name)
      expect(instance.instance_variable_get(:@args)).to eq({ test: { id: "1" } })
      expect(instance.instance_variable_get(:@context_args)).to eq({ parent: { id: "2" } })
    end

    it "works with keyword arguments for opts" do
      instance = described_class.new(
        delegate_mock,
        :name,
        nil,
        nil,
        page: { size: 50 },
        timeout: 30
      )

      expect(instance.instance_variable_get(:@context_opts)).to eq({
        page: { size: 50 },
        timeout: 30
      })
    end

    it "handles mix of positional and keyword arguments" do
      instance = described_class.new(
        delegate_mock,
        :mixed,
        { test: { id: "1" } },
        nil,
        page: { size: 25 }
      )

      expect(instance.name).to eq(:mixed)
      expect(instance.instance_variable_get(:@args)).to eq({ test: { id: "1" } })
      expect(instance.instance_variable_get(:@context_opts)).to eq({ page: { size: 25 } })
    end
  end
end
