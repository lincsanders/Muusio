require 'data_mapper'

class Db
  @bp=File.expand_path File.dirname(__FILE__)
  @database_path="#{@bp}/storage/data.db"

  class << self
    def run!
      if !File.exists?(@database_path)
        system("sqlite3 '#{@database_path}' ''")
      end

      DataMapper.setup(:default, "sqlite://#{@database_path}")

      Dir["#{@bp}/models/*.rb"].each {|file| require_relative file }

      DataMapper.finalize
      DataMapper.auto_upgrade!

      if !preferences = Preferences.first
        Preferences.create({})
      end
    end
  end
end