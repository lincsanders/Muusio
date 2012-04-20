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
      preferences: @@preferences,
    }
  end

  get '/' do
    erb :index
  end

  get '/version' do
    configuration.to_json
  end

  get '/files' do
    LibraryTrack.all.to_json
  end

  get '/stream_file/:file_hash' do
    file = LibraryTrack.all(file_hash: params[:file_hash]).first
    send_file File.open(file.fullpath)
  end

  get '/changes' do
    Indexer.changes.to_json
  end

  post '/download' do
    if Downloader.download_torrent(params[:torrent_url])
      "Torrent download initiated!"
    else
      "Error adding download... are you sure this isn't already downloading?"
    end
  end

  get '/current_downloads' do
    Downloader.current_downloads.to_json
  end
end