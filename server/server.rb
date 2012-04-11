require_relative "playlist"
require_relative "track"

class Server < Sinatra::Base
  use Playlist
  use Track

  set :bind, 'localhost'
  set :port, 44144

  MUUSIO_VERSION='0.1'

  def configuration
    {
      name:'Muusio',
      version: MUUSIO_VERSION,
      username: @@username,
      password: @@password,
      computer_name: @@computer_name,
    }
  end

  get '/' do
    p = Preferences.new
    p.username = @@username
    p.password = @@password
    p.computer_name = @@computer_name
    p.save
    p.to_json

    # configuration.to_json
  end

  get '/version' do
    configuration.to_json
  end

  get '/files' do
    @@files.to_json
  end

  get '/changes' do
    @@files.to_json
  end
end