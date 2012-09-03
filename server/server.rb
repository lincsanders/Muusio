require "rest_client"
require_relative "track"

class Server < Sinatra::Base
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

  get '/info/:file_hash' do
    if file = LibraryTrack.all(file_hash: params[:file_hash]).first
      begin
        mp3 = Mp3Info.open(file.fullpath)
      rescue => e
        puts e.inspect if @@logging
      end

      apic = {}
      if(mp3 && mp3.tag2 && mp3.tag2["APIC"])
        apic['text_encoding'], apic['mime_type'], apic['picture_type'], apic['description'], apic['picture_data'] = mp3.tag2["APIC"].unpack("c Z* c Z* a*")
      end

      headers 'Content-Type' => 'text/json'
      return {
        id3: file.id3,
        tag: mp3.tag,
        cover_url: apic['picture_data'] ? "/cover/#{file.file_hash}" : nil
      }.to_json
    end    
  end

  get '/cover/:file_hash' do
    if file = LibraryTrack.all(file_hash: params[:file_hash]).first
      begin
        mp3 = Mp3Info.open(file.fullpath)
      rescue => e
        puts e.inspect if @@logging
      end

      id3 = file.id3
      apic = {}

      if(mp3 && mp3.tag2 && mp3.tag2["APIC"])
        apic['text_encoding'], apic['mime_type'], apic['picture_type'], apic['description'], apic['picture_data'] = mp3.tag2["APIC"].unpack("c Z* c Z* a*")
      end

      headers 'Content-Type' => apic['mime_type']
      return apic['picture_data']
    end    
  end

  post '/notify' do
    if file = LibraryTrack.all(file_hash: params[:file_hash]).first

      begin
        mp3 = Mp3Info.open(file.fullpath)
      rescue => e
        puts e.inspect if @@logging
      end

      id3 = file.id3

      apic = {}

      if(mp3 && mp3.tag2 && mp3.tag2["APIC"])
        apic['text_encoding'], apic['mime_type'], apic['picture_type'], apic['description'], apic['picture_data'] = mp3.tag2["APIC"].unpack("c Z* c Z* a*")
      end

      # tmp = Tempfile.new('cover')
      # tmp.write(apic['picture_data'])
      # tmp.rewind
      # tmp.close

      # image = Devil.load_image(tmp.path)

      #thumb = image.resize 100, 100
      #headers 'Content-Type' => apic['mime_type']

      g = Growl.new "localhost", "ruby-growl"
      g.add_notification "notification", "ruby-growl Notification", (apic['picture_data'] && apic['picture_data'].size < 256000) ? apic['picture_data'] : nil
      g.notify "notification", "#{id3[:title]}", "#{(id3[:album] ? "#{id3[:album]}\n" : '') + (id3[:artist] ? "#{id3[:artist]}\n" : '')}"
      
      {status: true}.to_json
    end
  end

  post '/new_playlist' do
    if playlist = Playlist.all(name: params[:name]).first
      return {status: false, id: playlist.id, message: "This playlist already exists!"}.to_json 
    else
      Playlist.create({
        name: params[:name],
      })

      return {status: true}.to_json
    end
  end

  post '/add_to_playlist' do
    if (library_track = LibraryTrack.all(file_hash: params[:file_hash]).first) && (playlist = Playlist.all(id: params[:playlist_id]).first)
      playlist_track = PlaylistTrack.create({
        playlist_id: playlist.id,
        library_track_id: library_track.id,
      })
      
      return {status: true, library_track: library_track}.to_json
    else
      return {status: false, message: 'Track/Playlist not found.'}.to_json
    end
  end

  get '/playlists' do
    Playlist.all.to_json
  end

  get '/playlist/:id' do
    if playlist = Playlist.all(id: params[:id]).first
      tracks = []

      playlist.playlist_tracks.each { |pt| tracks << pt.library_track }

      return tracks.to_json
    else
      return {status: false, message: 'Playlist not found.'}.to_json
    end
  end

  get '/playlist/:id/delete' do
    if playlist = Playlist.all(id: params[:id]).first
      playlist.playlist_tracks.all.destroy
      
      playlist.destroy
    else
      return {status: false, message: 'Playlist not found.'}.to_json
    end
  end
end