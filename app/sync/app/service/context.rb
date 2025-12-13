module Context
  RootContext = Data.define(:name, :datasets)

  def self.root(args, api = Api[:idah])
    RootContext.new(
      [:export, Time.now.to_i].join("."),
      ContextApi::Datasets.new({}, args, api))
  end
end