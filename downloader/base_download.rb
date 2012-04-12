class BaseDownload
  @filename=nil
  @tmp_file=nil
  @destination=nil
  @files_moved=false

  def unique_file(filepath)
    counter = 1
    filename = File.basename(filepath)
    directory = File.dirname(filepath)

    while FileTest.exist?(filepath)
      new_filename = File.basename(filename, File.extname(filename)) + " (#{counter.to_s})" + File.extname(filename)

      filepath = "#{directory}/#{new_filename}"
      counter += 1
    end

    filepath
  end
end
