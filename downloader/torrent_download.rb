require_relative 'base_download'

class TorrentDownload < BaseDownload

  @bittorrent=nil
  @torrent_file=nil

  def initialize(torrent_file, filename=nil, tmp_file=nil)
    @torrent_file = torrent_file

    mi = RubyTorrent::MetaInfo.from_location(@torrent_file)

    @filename = filename ? filename : mi.info.name
    @tmp_file = tmp_file ? tmp_file : unique_file("#{Downloader.tmp_dir}#{@filename}")

    @bittorrent = RubyTorrent::BitTorrent.new(@torrent_file, @tmp_file)
  end

  def move_finished_download(destination=nil)
    @destination = destination ? destination : unique_file(Downloader.destination_dir + @filename)

    FileUtils.mv(@tmp_file, @destination)
    if File.exists?(@torrent_file)
      FileUtils.rm(@torrent_file)
    end
  end

  def is_complete?
    @bittorrent.percent_completed == 100.0
  end

  def torrent_file; @torrent_file; end
  def filename; @filename; end
  def target; @target; end
  def bittorrent; @bittorrent; end
  def percent; @bittorrent.percent_completed; end
  def tmp_file; @tmp_file; end
end