require "rest_client"
require_relative "playlist"
require_relative "track"

class Server < Sinatra::Base
  use Playlist
  use Track

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
    return [false].to_json if !file
    
    send_file File.open(file.fullpath)
  end

  get '/changes' do
    Indexer.changes.to_json
  end

  post '/download' do
    r = RestClient.post @@mothership+'/a_little_help', :file_hash => params[:file_hash]
    r = JSON.parse r

    Downloader.download_torrent(r['t'], r['file_name'])

    {status: 'Download Thread Spawned!'}.to_json
  end

  post '/download_torrent' do
    Downloader.download_torrent(params[:torrent])

    {status: 'Download Thread Spawned!'}.to_json
  end

  post '/upload' do
    file = LibraryTrack.all(file_hash: params[:file_hash]).first

    r = RestClient.post @@mothership+'/a_little_help', :file_hash => file.file_hash
    r = JSON.parse r

    if !r['t']
      r = RestClient.post @@mothership+'/upload', :file => File.new(file.fullpath, 'rb'), :file_hash => file.file_hash, :file_name => file.filename, :api_token => @@preferences.api_token
      r = JSON.parse r
    end

    {t: r['t']}.to_json
  end

  post '/add_folder' do
    folder = WatchedFolder.all(path: params[:path]).first
    new_folder = WatchedFolder.create({path: params[:path]}) if !folder

    Indexer.listen_for_file_changes params[:path]

    {status: 'Folder Added!'}.to_json
  end

  get '/available_downloads' do
    r = RestClient.post @@mothership+'/available_files', :api_token => @@preferences.api_token
    r = JSON.parse r

    r.to_json
  end

  post '/open_file_location' do
    if file = LibraryTrack.all(file_hash: params[:file_hash]).first
      system "open '#{file.path}'"

      {status: "Open Launched"}.to_json
    else
      {status: false, file: file}.to_json
    end

  end

  get '/current_downloads' do
    Downloader.current_downloads.to_json
  end
end