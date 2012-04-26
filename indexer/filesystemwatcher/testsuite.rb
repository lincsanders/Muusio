require 'runit/testcase'
require 'filesystemwatcher'

class WatcherTests < RUNIT::TestCase
  def testStatuses()
    fileName = File.expand_path("testfile.txt")
    File.delete(fileName) if File.exists?(fileName)

    newFile = nil
    modFile = nil
    delFile = nil

    watcher = FileSystemWatcher.new(".", "*.txt")
    watcher.sleepTime = 1
    watcher.start { |status,file|
      if status == FileSystemWatcher::CREATED then
	newFile = file
      elsif status == FileSystemWatcher::MODIFIED then
	modFile = file
      elsif status == FileSystemWatcher::DELETED then
	delFile = file
      end
    }

    sleep(1)

    f = File.new(fileName, "w")
    f.puts("test")
    f.close()

    sleep(3)
    assert_equals(fileName, newFile)
    assert_nil(modFile)
    assert_nil(delFile)

    f = File.new(fileName, "a")
    f.puts("test")
    f.close()

    sleep(3)
    assert_equals(fileName, newFile)
    assert_equals(fileName, modFile)
    assert_nil(delFile)

    File.delete(fileName)
    sleep(3)

    assert_equals(fileName, newFile)
    assert_equals(fileName, modFile)
    assert_equals(fileName, delFile)
  end
end

#--- main program ----
if __FILE__ == $0
  require 'runit/cui/testrunner'
  RUNIT::CUI::TestRunner.run(WatcherTests.suite)
end
