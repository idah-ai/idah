module Context
  class ProceduralEnumerableCrud < ProceduralCrud
    def index(**opts)
      page = build_opts(opts)&.dig(:opts, :page, :number)
      if !page || page == 1
        super(**opts)
      else
        []
      end
    end
  end
end