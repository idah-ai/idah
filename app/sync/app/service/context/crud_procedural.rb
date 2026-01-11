module Context
  class CrudProcedural < DelegatedProc
    def index(**opts)
      call(**opts)
    end
  end
end