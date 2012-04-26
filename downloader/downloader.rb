require 'rubygems'
require 'rubytorrent-allspice'
require 'thread'
require 'fssm'
require 'fileutils'
require 'open-uri'
require 'cgi'

require_relative 'torrent_download'
require_relative 'youtube_download'

class Downloader
  @bp = File.expand_path File.dirname(__FILE__)

  @torrent_monitor_thread = nil
  @download_threads = []
  @current_downloads = []

  class << self
    def tmp_dir; @bp + '/in_progress/'; end;
    def destination_dir; @bp + '/../indexer/mp3/received/'; end;
    def current_downloads; @current_downloads; end;

    def run!
      if !File.directory?(tmp_dir)
        FileUtils.mkdir(tmp_dir)
      end

      if !File.directory?(destination_dir)
        FileUtils.mkdir(destination_dir)
      end

      # No longer monitoring for files
      # @torrent_file_monitor_thread=Thread.new{torrent_file_monitor}
      Thread.new{
        while true
          @download_threads.each do |t|
            if !t.alive?
              @download_threads.delete(t) 
              puts "Thread killed gracefully!" if @@logging
            end
          end
          puts "#{@download_threads.length} total download threads..." if @@logging && @download_threads.length > 0
          sleep 10
        end 
      }
    end

    def download_torrent(torrent_file, filename=nil)
      return false if (torrent_file.nil? || torrent_file == '')

      @download_threads << Thread.new{
        puts "Downloading #{torrent_file}" if @@logging
        download = TorrentDownload.new(torrent_file, filename)
        @current_downloads << download

        progress = -1.0

        while !download.is_complete?
          puts "#{torrent_file}: " + download.percent.round(2).to_s + "%" if @@logging
          sleep 3
        end

        puts download.filename + " download complete, moving files..." if @@logging

        download.move_finished_download

        puts download.filename + " now ready to play!" if @@logging

        @current_downloads.delete(download)
        self.kill
      }

      true
    end

    def download_youtube(url)

      @download_threads << Thread.new{
        puts "Downloading #{url}" if @@logging
        download = YoutubeDownload.new(url)
        @current_downloads << download

        puts download.filename + " download complete, moving files..." if @@logging

        download.move_finished_download

        puts download.filename + " now ready to play!" if @@logging

        @current_downloads.delete(download)
        self.kill
      }
    end

    def download_soundcloud(url)
      # TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO 
    end

    # def torrent_file_monitor
    #   # Existing torrents
    #   Dir.glob(TORRENTS_DIR+'/**.torrent').each do |filename|
    #     puts "Added existing torrent #{filename}" if @@logging
    #     download_torrent(filename)
    #   end

    #   # Watch for new torrents
    #   FSSM.monitor(TORRENTS_DIR, '**.torrent') do
    #     puts "Monitoring Initialized, watching for new torrents."
    #     create do |path,file|
    #       Downloader.download_torrent("#{TORRENTS_DIR}/#{file}") if @@logging
    #     end
    #   end
    # end

  end
end