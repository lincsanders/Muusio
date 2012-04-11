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

  @torrent_monitor_thread=nil
  
  @download_threads=[]

  TORRENTS_DIR='./torrents'

  class << self

    def run!
      @torrent_file_monitor_thread=Thread.new{torrent_file_monitor}

      Downloader.download_torrent('http://lincoln-mba-public.s3.amazonaws.com/Gemini%20-%20No%20Way%20Out.mp3?torrent')

      while true
        @download_threads.each do |t|
          if !t.alive?
            @download_threads.delete(t) 
            puts "Thread killed gracefully!"
          end
        end
        puts "#{@download_threads.length} total threads..."
        sleep 10
      end
    end

    def torrent_file_monitor
      # Existing torrents
      Dir.glob(TORRENTS_DIR+'/**.torrent').each do |filename|
        puts "Added existing torrent #{filename}"
        download_torrent(filename)
      end

      # Watch for new torrents
      FSSM.monitor(TORRENTS_DIR, '**.torrent') do
        puts "Monitoring Initialized, watching for new torrents."
        create do |path,file|
          Downloader.download_torrent("#{TORRENTS_DIR}/#{file}")
        end
      end
    end

    def download_torrent(torrent_file)

      @download_threads << Thread.new{
        puts "Downloading #{torrent_file}"
        download = TorrentDownload.new(torrent_file)

        progress = -1.0

        while !download.is_complete?
          puts "#{torrent_file}: " + download.percent.round(2).to_s + "%"
          sleep 3
        end

        puts download.filename + " download complete, moving files..."

        download.move_finished_download

        puts download.filename + " now ready to play!"

        self.kill
      }
    end

    def download_youtube(url)

      @download_threads << Thread.new{
        puts "Downloading #{url}"
        download = YoutubeDownload.new(url)

        puts download.filename + " download complete, moving files..."

        download.move_finished_download

        puts download.filename + " now ready to play!"

        self.kill
      }
    end

    def download_soundcloud(url)
      # TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO 
    end
  end

  run!
end