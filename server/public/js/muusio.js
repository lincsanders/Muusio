jQuery.expr[':'].contains = function(a, i, m) { 
  return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0; 
};

MuusioPlayer = {

	currentTrack: null,
	updateProgressBarTimer: null,
	volume: 100,
	tracks: {},
	filterBy: "",
	sorting: "song-artist",
	queue: [],

	init: function(){
		soundManager.url = '/soundmanager/swf/';
		MuusioPlayer.bindHotkeys();

		//For now... flash plays better... but the HTML fallback will still exist
		soundManager.preferFlash = true;

		soundManager.onready(function() {
			$(function(){
				MuusioPlayer.fetchSongs();
				MuusioPlayer.bindInterface();
			})
		});
	},

	fetchSongs: function(){
		$.getJSON('/files', function(data){
			var newTracks = {};
			$.each(data, function(k,track){
				newTracks[track.file_hash] = track;
			});

			if(JSON.stringify(MuusioPlayer.tracks) != JSON.stringify(newTracks) || MuusioPlayer.tracks == {}){
				console.log('Redrawing tracks...');
				MuusioPlayer.tracks = newTracks;
				MuusioPlayer.drawTracks();
				MuusioPlayer.filterSongList();
			}
		});

		setTimeout('MuusioPlayer.fetchSongs()', 10000);
	},

	playTrack: function(track){
		MuusioPlayer.id3 = track.id3;
		soundManager.stopAll();
		sound = MuusioPlayer.getSound(track);
		MuusioPlayer.currentTrack = soundManager.play(track.file_hash);
		MuusioPlayer.drawInterface();
	},

	drawTracks: function(){
		var newTrackList=[];
		$.each(MuusioPlayer.tracks, function(k,track){
			$track = $('#song-tmpl').tmpl(track)

			$track.click(function(){
				MuusioPlayer.playTrack(track);
			})

			$track.find('.queue-song').on('click', function(e){
				MuusioPlayer.queueTrack(track.file_hash);

				e.preventDefault(); return false;
			})

			$track.find('.open-file-location').on('click', function(e){
				MuusioPlayer.openFileLocation(track.file_hash);

				e.preventDefault(); return false;
			})

			newTrackList.push($track);
		})

		$('#song-list').empty();
		$(newTrackList).appendTo('#song-list');
		MuusioPlayer.sortTracks();

		//Always have a currentTrack
		if(!MuusioPlayer.currentTrack) MuusioPlayer.currentTrack = MuusioPlayer.getSound(MuusioPlayer.tracks[$(MuusioPlayer.ui.$songList.find('.track')[0]).attr('id')]);

		MuusioPlayer.drawInterface();
	},

	drawInterface: function(){
		trackInfo = MuusioPlayer.tracks[MuusioPlayer.currentTrack.sID];

		if(trackInfo){
			MuusioPlayer.ui.$progress.progressbar('option', 'value', 0);
			$('.playing').removeClass('playing');
			$('#'+trackInfo.file_hash).addClass('playing');	
		}
	},

	bindInterface: function(){
		progressBar = $('#song-progress').progressbar({value: 0});

		MuusioPlayer.ui = {
			$progress: progressBar,
			$songList: $('#song-list'),
			$availableSongs: $('#available-song-list'),
			$totalTime: $('#total-time'),
			$currentTime: $('#current-time'),
			$playPauseButton: $('#play-pause-button'),
			$hideableControls: $('#hideable-controls')
		}

		$('#play-pause-button').click(function(e){
			MuusioPlayer.playPause();
			e.preventDefault(); return false;
		});

		$('#prev-button').click(function(e){
			MuusioPlayer.playPrev();
			e.preventDefault(); return false;
		})

		$('#next-button').click(function(e){
			MuusioPlayer.playNext();
			e.preventDefault(); return false;
		})

		$('#upload-button').click(function(e){
			MuusioPlayer.uploadTrack();
			e.preventDefault(); return false;
		})

		$('#sort-artist').click(function(e){
			if(MuusioPlayer.sorting != 'song-artist'){
				MuusioPlayer.sorting = 'song-artist'
				MuusioPlayer.sortTracks();
			}

			e.preventDefault(); return false;
		})

		$('#sort-album').click(function(e){
			if(MuusioPlayer.sorting != 'song-album'){
				MuusioPlayer.sorting = 'song-album'
				MuusioPlayer.sortTracks();
			}

			e.preventDefault(); return false;
		})

		$('#sort-title').click(function(e){
			if(MuusioPlayer.sorting != 'song-title'){
				MuusioPlayer.sorting = 'song-title'
				MuusioPlayer.sortTracks();
			}

			e.preventDefault(); return false;
		})

		$('#sort-random').click(function(e){
			if(MuusioPlayer.sorting != 'song-random')
				MuusioPlayer.sorting = 'song-random'

			MuusioPlayer.sortTracks();

			e.preventDefault(); return false;
		})

		$('#show-available-downloads-button').click(function(e){
			MuusioPlayer.showAvailableDownloads();
			e.preventDefault(); return false;
		})

		$('#show-hide-controls').click(function(e){
			MuusioPlayer.showHideControls();
			e.preventDefault(); return false;
		})

		//Click on the progress bar to FF
		MuusioPlayer.ui.$progress.click(function(e){	
			MuusioPlayer.currentTrack.setPosition((e.offsetX/$(this).width()) * MuusioPlayer.currentTrack.durationEstimate);
			MuusioPlayer.updateProgressBar();
		});

		MuusioPlayer.updateProgressBar();

		$('#song-list-filter').focus().keyup(function() {
			MuusioPlayer.filterBy = $(this).val();
			MuusioPlayer.filterSongList();
		});
	},

	bindHotkeys: function(){
		$('body').keypress(function(e){
			if(!$('input').is(':focus')){
				if(e.keyCode == 32){
					MuusioPlayer.playPause();
				}	

				e.preventDefault();
			}
		});
	},

	showAvailableDownloads: function(){
		if(MuusioPlayer.ui.$availableSongs.css('display') == 'none'){
			$.getJSON('/available_downloads', function(data){
				MuusioPlayer.ui.$availableSongs.empty();
				availableTracks = [];

				$.each(data, function(k,track){
					$track = $('#available-song-tmpl').tmpl(track)

					$track.click(function(e){
						MuusioPlayer.downloadTrack($(this).attr('data-file-hash'));
						e.preventDefault(); return false;
					});

					$track.appendTo(MuusioPlayer.ui.$availableSongs);
				});
			});
		}

		MuusioPlayer.ui.$availableSongs.toggle();
	},

	filterSongList: function(){
		$('#song-list .track').addClass('hidden');

		if(!MuusioPlayer.filterBy){
			$('#song-list .track').removeClass('hidden');
		}else{
			var containsSelector = '';

			$.each(MuusioPlayer.filterBy.split(' '), function(k,string){
				if(string){
					containsSelector = containsSelector + ':contains("' + string + '")';
				}
			})
			
			$('#song-list .track'+containsSelector).removeClass('hidden');	
		}
	},

	onTrackFinish: function(){
		MuusioPlayer.playNext();
	},

	queueTrack: function(sID){
		MuusioPlayer.queue.push(sID);
	},

	playNext: function(){
		if(MuusioPlayer.queue.length > 0){
			nextTrackSID = MuusioPlayer.queue[0];
			MuusioPlayer.queue = MuusioPlayer.queue.slice(1);
		} else{
			$next = $("#song-list .track:not('[class*=hidden]')").filter('#'+MuusioPlayer.currentTrack.sID).nextAll(":not(.hidden):first");
			if($next.length < 1)
				$next = $("#song-list .track:not('[class*=hidden]'):first");	

			nextTrackSID = $next.attr('id');
		}

		console.log("Now looking for " + nextTrackSID);
		MuusioPlayer.playTrack(MuusioPlayer.tracks[nextTrackSID]);
	},

	playPrev: function(){
		$prev = $("#song-list .track:not('[class*=hidden]')").filter('#'+MuusioPlayer.currentTrack.sID).prevAll(":not(.hidden):first");

		if($prev.length < 1)
			$prev = $("#song-list .track:not('[class*=hidden]'):last");

		MuusioPlayer.playTrack(MuusioPlayer.tracks[$prev.attr('id')]);
	},

	playPause: function(){

		if(MuusioPlayer.currentTrack.playState == 0)
			MuusioPlayer.currentTrack.play();
		else if(MuusioPlayer.currentTrack.paused)
			MuusioPlayer.currentTrack.resume(); 
		else 
			MuusioPlayer.currentTrack.pause();
	},

	monitorTrack: function(track){
		//MuusioPlayer.updateProgressBar();
	},

	getSound: function(track){
		return soundManager.createSound({
			id: track.file_hash,
			url: '/stream_file/'+track.file_hash,
			onfinish: function(){
				MuusioPlayer.onTrackFinish(track.file_hash)
			},
			whileplaying: function(){
				MuusioPlayer.monitorTrack(this);
			},
			onload: function(){}
		});
	},

	updateProgressBar: function(){
		if(MuusioPlayer.currentTrack != null && MuusioPlayer.currentTrack.position){
			percentageComplete = (MuusioPlayer.currentTrack.position / (MuusioPlayer.currentTrack.durationEstimate / 100));
			MuusioPlayer.ui.$progress.progressbar("option", 'value', percentageComplete);
			d = new Date(MuusioPlayer.currentTrack.durationEstimate);
			time = ('0'+d.getMinutes().toString()).substr(-2) + ':' + ('0'+d.getSeconds().toString()).substr(-2)
			if(d.getHours() - 1 > 0) time = ('0'+d.getHours().toString()).substr(-2) + ':' + time
			MuusioPlayer.ui.$totalTime.html(time);
			d = new Date(MuusioPlayer.currentTrack.position);
			time = ('0'+d.getMinutes().toString()).substr(-2) + ':' + ('0'+d.getSeconds().toString()).substr(-2)
			if(d.getHours() - 1 > 0) time = ('0'+d.getHours().toString()).substr(-2) + ':' + time
			MuusioPlayer.ui.$currentTime.html(time);
		}

		clearTimeout(MuusioPlayer.updateProgressBarTimer);
		MuusioPlayer.updatePlayPauseButton();

		MuusioPlayer.updateProgressBarTimer = setTimeout('MuusioPlayer.updateProgressBar()', 200);
	},

	uploadTrack: function(){
		$.ajax({
			url: '/upload',
			type: 'POST',
			data: {file_hash: MuusioPlayer.currentTrack.sID},
			dataType: 'json',
			success: function(data){
				console.log(data);
			}
		})
	},

	openFileLocation: function(sID){
		$.ajax({
			url: '/open_file_location',
			type: 'POST',
			data: {file_hash: sID},
			dataType: 'json',
			success: function(data){
				console.log(data);
			}
		})
	},

	downloadTrack: function(file_hash){
		$.ajax({
			url: '/download',
			type: 'POST',
			data: {'file_hash': file_hash},
			dataType: 'json',
			success: function(data){
				console.log(data);
			}
		})
	},

	sortTracks: function () {
		if(MuusioPlayer.sorting == 'song-random'){
			$('div#song-list>div').tsort({order: 'rand'});
		}else if(MuusioPlayer.sorting)
			$('div#song-list>div').tsort('.'+MuusioPlayer.sorting);
	},

	updatePlayPauseButton: function(){
		MuusioPlayer.ui.$playPauseButton.removeClass('play').removeClass('pause');

		if(!MuusioPlayer.currentTrack || MuusioPlayer.currentTrack.playState == 0 || MuusioPlayer.currentTrack.paused){
			MuusioPlayer.ui.$playPauseButton.addClass('play');
			MuusioPlayer.ui.$playPauseButton.html('►');
		}else {
			MuusioPlayer.ui.$playPauseButton.addClass('pause');
			MuusioPlayer.ui.$playPauseButton.html('❚❚');
		}
	},

	showHideControls: function(){
		if(MuusioPlayer.ui.$hideableControls.css('display') == 'none'){
			MuusioPlayer.ui.$hideableControls.slideDown('fast');
		}else
			MuusioPlayer.ui.$hideableControls.slideUp('fast');
	}
}