RSpec.describe Context::Io do
  let(:command_class) do
    Class.new(Command::Base) do
      def initialize(**opts)
        @name = opts[:name]
      end

      def name
        @name || :default_command
      end
    end
  end

  describe "#initialize" do
    context "with valid Command::Base subclass" do
      it "creates instance of command class" do
        instance = described_class.new(command_class)

        expect(instance.send(:__getobj__)).to be_a(command_class)
      end

      it "passes name option to command" do
        instance = described_class.new(command_class, nil, nil, name: :custom_io)

        expect(instance.send(:__getobj__).name).to eq(:custom_io)
      end
    end

    context "with invalid io_class" do
      it "raises InvalidContext if not Command::Base subclass" do
        invalid_class = Class.new

        expect {
          described_class.new(invalid_class)
        }.to raise_error(
          Context::Error::InvalidContext,
          /invalid_io_delegate/
        )
      end

      it "raises InvalidContext with class name in error" do
        invalid_class = Class.new

        expect {
          described_class.new(invalid_class)
        }.to raise_error(
          Context::Error::InvalidContext,
          /#{invalid_class}/
        )
      end
    end

    it "builds context opts with io namespace" do
      opts = { name: :test_io, timeout: 30 }
      instance = described_class.new(command_class, nil, nil, **opts)

      # Should have built opts under :io key
      context_opts = instance.instance_variable_get(:@context_opts)
      expect(context_opts).to have_key(:io)
    end

    it "passes args to super" do
      args = { io: { command: "test" } }
      instance = described_class.new(command_class, args)

      expect(instance.instance_variable_get(:@args)).to eq(args)
    end

    it "passes context to super" do
      context = { parent: { id: "parent-1" } }
      instance = described_class.new(command_class, nil, context)

      expect(instance.instance_variable_get(:@context_args)).to eq(context)
    end
  end

  describe "integration with Command::Base" do
    it "wraps command instance" do
      instance = described_class.new(command_class, nil, nil, name: :my_command)

      wrapped = instance.send(:__getobj__)
      expect(wrapped).to be_a(command_class)
      expect(wrapped.name).to eq(:my_command)
    end
  end

  describe "real-world usage" do
    context "creating IO context for file operations" do
      let(:file_command) do
        Class.new(Command::Base) do
          def initialize(**opts)
            @name = opts[:name] || :file_io
          end

          attr_reader :name
        end
      end

      it "creates named IO context" do
        instance = described_class.new(file_command, nil, nil, name: :csv_importer)

        expect(instance.send(:__getobj__).name).to eq(:csv_importer)
      end
    end
  end

  describe "edge cases" do
    context "with nil opts" do
      it "handles nil opts" do
        instance = described_class.new(command_class)

        expect(instance.send(:__getobj__)).to be_a(command_class)
      end
    end

    context "with empty opts" do
      it "handles empty opts hash" do
        instance = described_class.new(command_class, nil, nil, **{})

        expect(instance.send(:__getobj__)).to be_a(command_class)
      end
    end
  end
end
