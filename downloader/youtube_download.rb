require_relative 'base_download'

class YoutubeDownload < BaseDownload

  @youtube_url=nil
  @tmp_flv=nil
  @tmp_mp3=nil
  
  @complete = false

  def initialize(youtubepath)
    uri = URI.parse(youtubepath)

    open(uri) do |file|
      openedsource = file.read
      #  search for the title
      rgtitlesearch = Regexp.new(/\<meta name="title" content=.*/)
      @filename = rgtitlesearch.match(openedsource)
      @filename = @filename[0].gsub("<meta name=\"title\" content=\"","").gsub("\">","")
    
      @tmp_flv = TMP_DIR + @filename + '.flv'
      @tmp_mp3 = TMP_DIR + @filename + '.mp3'
      @destination = DESTINATION_DIR + @filename + '.mp3'

      # search for the download link
      rglinksearch = Regexp.new(/,url=.*\\u0026quality=/)
      vidlink = rglinksearch.match(openedsource)
      vidlink[0].split(",url=").each do |foundlinks|
        #DESPERATELY need to increase the quality this scrapes
        vidlink = foundlinks.gsub(",url=","").gsub("%3A",":").gsub("%2F","/").gsub("%3F","?").gsub("%3D","=").gsub("%252C",",").gsub("%253A",":").gsub("%26","&").gsub("\\u0026quality","")
      end
      puts "downloading from #{vidlink}"

      puts "Download link found for #{@filename}!"

      writeOut = open(@tmp_flv, "wb")
      writeOut.write(open(vidlink).read)
      writeOut.close

      convert_to_mp3
    end

    @complete = true
  end

  def convert_to_mp3
    puts "ffmpeg conversion executed"
    system "ffmpeg -i \"#{@tmp_flv}\" -acodec mp3 -ab 128 \"#{@tmp_mp3}\""
    puts "ffmpeg conversion complete!"

    #FileUtils.rm(@tmp_flv)
  end

  def move_finished_download(destination=nil)
    FileUtils.mv(@tmp_mp3, unique_file(@destination))
  end

  def is_complete?
    @complete
  end

  def filename; @filename; end
  def target; @target; end
  def status; "Working..."; end
  def tmp_file; @tmp_file; end
end