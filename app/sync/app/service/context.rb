module Context
  def self.new(contexts = nil)
    EnumerableContext.new(contexts)
  end
end