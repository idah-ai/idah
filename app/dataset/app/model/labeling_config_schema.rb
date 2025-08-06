LabelingConfigSchema = Verse.define do
  field :properties, Array do
    field(:id, String)
    field(:type, String)

    field?(:format, Hash)
    field?(:label, String)
    field?(:description, String)

    field(:required, Boolean).default(false)
    field?(:selector, Array, of: String).default(["*"])
  end

  field :categories, Array do
    field(:id, String)
    field(:label, String)
    field(:type, String)
    field(:color, String)

    field?(:description, String)
  end
end