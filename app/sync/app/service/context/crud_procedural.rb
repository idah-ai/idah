module Context
  class CrudProcedural < DelegatedProc
    def index(**opts)
      return if opts[:page] && opts[:page][:number] != 1
      call(**opts)
    end
  end
end