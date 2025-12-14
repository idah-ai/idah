module Context
  RootContext = Data.define(:name, :api)

  def self.root(args, api = :idah)
    RootContext.new(
      [:export, Time.now.to_i].join("."),
      ContextApi.api(args, api)
    )
  end
end