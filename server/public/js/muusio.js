jQuery.expr[':'].contains = function(a, i, m) { 
  return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0; 
};

MuusioPlayer = {

	currentTrack: null,
	updateProgressBarTimer: null,
	filterSongListTimer: null,
	volume: 100,
	tracks: {},
	sorting: "song-artist",

	init: function(){
		soundManager.setup({
			url: '/soundmanager2/swf/',
			//For now... flash plays better... but the HTML fallback will still exist
			preferFlash: true,
			waitForWindowLoad: true,
			useWaveformData: true,
			useHighPerformance: true
		})
		MuusioPlayer.bindHotkeys();


		soundManager.onready(function() {
			$(function(){
				MuusioPlayer.fetchSongs();
				MuusioPlayer.bindInterface();
			})
		});
	},

	getQueue: function(){
		if(!localStorage.getItem('queue'))
			return [];

		queue = JSON.parse(localStorage.getItem('queue'));
		return queue.length ? queue : [];
	},

	setQueue: function(newQueue){
		return localStorage.setItem('queue', newQueue ? JSON.stringify(newQueue) : JSON.stringify([]))
	},

	getFilterBy: function(){
		return localStorage.getItem('filterBy')
	},

	setFilterBy: function(filterBy){
		return localStorage.setItem('filterBy', filterBy ? filterBy : '');
	},

	getNextSongId: function(popQueue){
		if(MuusioPlayer.getQueue().length > 0){
			nextTrackSID = MuusioPlayer.getQueue()[0];
			if(popQueue) MuusioPlayer.setQueue(MuusioPlayer.getQueue().slice(1));
		}else if(!MuusioPlayer.currentTrack){
			$next = $("#song-list .track:not('[class*=hidden]'):first");

			nextTrackSID = $next.attr('id');
		} else{

			$next = $("#song-list .track:not('[class*=hidden]')").filter('#'+MuusioPlayer.currentTrack.sID).nextAll(":not(.hidden):first");
			if($next.length < 1)
				$next = $("#song-list .track:not('[class*=hidden]'):first");

			nextTrackSID = $next.attr('id');
		}

		return nextTrackSID;
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

	setCurrentTrack: function(sound){
		MuusioPlayer.id3 = MuusioPlayer.tracks[sound.sID].id3;

		MuusioPlayer.updateTrackNameDisplay();

		MuusioPlayer.currentTrack = sound;
		MuusioPlayer.updateProgressBar();
	},

	playTrack: function(track){
		MuusioPlayer.id3 = track.id3;

		prevTrack = MuusioPlayer.currentTrack;

		if(soundManager.sounds[track.file_hash]){
			newTrack = soundManager.sounds[track.file_hash]

			if(newTrack.playState != 0)
				newTrack.stop();

			newTrack.play();

			MuusioPlayer.setCurrentTrack(newTrack);
		} else {
			sound = MuusioPlayer.getSound(track);
			MuusioPlayer.setCurrentTrack(soundManager.play(track.file_hash));
		}

		if(prevTrack.sID != MuusioPlayer.currentTrack.sID)
			prevTrack.stop();

		MuusioPlayer.sendPlayingNotification();

		MuusioPlayer.setSavedCurrentTrackId(MuusioPlayer.currentTrack.sID)

		//Remove the song from the queue if is is the next song in line to play
		if(MuusioPlayer.getQueue()[0] == MuusioPlayer.currentTrack.sID);
			MuusioPlayer.setQueue(MuusioPlayer.getQueue().slice(1));

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
		if(!MuusioPlayer.currentTrack){
			MuusioPlayer.filterSongList();

			if(MuusioPlayer.getSavedCurrentTrackId()) 
				track = MuusioPlayer.tracks[MuusioPlayer.getSavedCurrentTrackId()];
			else
				track = MuusioPlayer.tracks[MuusioPlayer.getNextSongId()];

			MuusioPlayer.setCurrentTrack(MuusioPlayer.getSound(track));
		}

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
		MuusioPlayer.ui = {
			$progress: $('#song-progress').progressbar({value: 0}),
			$songList: $('#song-list'),
			$availableSongs: $('#available-song-list'),
			$totalTime: $('#total-time'),
			$currentTime: $('#current-time'),
			$playPauseButton: $('#play-pause-button'),
			$prevButton: $('#prev-button'),
			$nextButton: $('#next-button'),
			$uploadButton: $('#upload-button'),
			$queue: $('#queue-song-list'),
			$rightPanel: $('#right-panel'),
			$showHideRightPanel: $('#show-hide-right-panel'),
			$hideableControls: $('#hideable-controls'),
			$songListFilter: $('#song-list-filter'),
			$trackNameDisplay: $('#track-name-display'),
			$sortArtist: $('#sort-artist'),
			$sortAlbum: $('#sort-album'),
			$sortTitle: $('#sort-title'),
			$sortRandom: $('#sort-random'),
			$showAvailableDownloadsButton: $('#show-available-downloads-button'),
			$showHideControls: $('#show-hide-controls')
		}

		ui = MuusioPlayer.ui;

		ui.$showHideRightPanel.on('click', MuusioPlayer.showHideRightPanel);

		ui.$playPauseButton.on('click', function(e){
			MuusioPlayer.playPause();
			e.preventDefault(); return false;
		});

		ui.$prevButton.on('click', function(e){
			MuusioPlayer.playPrev();
			e.preventDefault(); return false;
		})

		ui.$nextButton.on('click', function(e){
			MuusioPlayer.playNext();
			e.preventDefault(); return false;
		})

		ui.$uploadButton.on('click', function(e){
			MuusioPlayer.uploadTrack();
			e.preventDefault(); return false;
		})

		ui.$sortArtist.on('click', function(e){
			if(MuusioPlayer.sorting != 'song-artist'){
				MuusioPlayer.sorting = 'song-artist'
				MuusioPlayer.sortTracks();
			}

			e.preventDefault(); return false;
		})

		ui.$sortAlbum.on('click', function(e){
			if(MuusioPlayer.sorting != 'song-album'){
				MuusioPlayer.sorting = 'song-album'
				MuusioPlayer.sortTracks();
			}

			e.preventDefault(); return false;
		})

		ui.$sortTitle.on('click', function(e){
			if(MuusioPlayer.sorting != 'song-title'){
				MuusioPlayer.sorting = 'song-title'
				MuusioPlayer.sortTracks();
			}

			e.preventDefault(); return false;
		})

		ui.$sortRandom.on('click', function(e){
			if(MuusioPlayer.sorting != 'song-random')
				MuusioPlayer.sorting = 'song-random'

			MuusioPlayer.sortTracks();

			e.preventDefault(); return false;
		})

		ui.$showAvailableDownloadsButton.on('click', function(e){
			MuusioPlayer.showAvailableDownloads();
			e.preventDefault(); return false;
		})

		ui.$showHideControls.on('click', function(e){
			MuusioPlayer.showHideControls();
			e.preventDefault(); return false;
		})

		ui.$showHideRightPanel.on('mouseover', function(e){
			$(this).animate({opacity: 1});
		})

		ui.$showHideRightPanel.on('mouseleave', function(e){
			$(this).animate({opacity: 0.2});
		})

		//Click on the progress bar to FF
		ui.$progress.on('click', function(e){	
			MuusioPlayer.currentTrack.setPosition((e.offsetX/$(this).width()) * MuusioPlayer.currentTrack.durationEstimate);
			MuusioPlayer.updateProgressBar();
		});

		MuusioPlayer.updateProgressBar();

		ui.$songListFilter.val(MuusioPlayer.getFilterBy());

		ui.$songListFilter.focus().keyup(function() {
			MuusioPlayer.setFilterBy($(this).val());

			clearTimeout(MuusioPlayer.filterSongListTimer);
			MuusioPlayer.filterSongListTimer = setTimeout(MuusioPlayer.filterSongList, 300);
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

		if(!MuusioPlayer.getFilterBy()){
			$('#song-list .track').removeClass('hidden');
		}else{
			var containsSelector = '';

			$.each((MuusioPlayer.getFilterBy()).split(' '), function(k,string){
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
		queue = MuusioPlayer.getQueue();
		queue.push(sID)
		MuusioPlayer.setQueue(queue);
	},

	playNext: function(){
		nextTrackSID = MuusioPlayer.getNextSongId();

		if(nextTrackSID) MuusioPlayer.playTrack(MuusioPlayer.tracks[nextTrackSID]);
	},

	playPrev: function(){
		$prev = $("#song-list .track:not('[class*=hidden]')").filter('#'+MuusioPlayer.currentTrack.sID).prevAll(":not(.hidden):first");

		if($prev.length < 1)
			$prev = $("#song-list .track:not('[class*=hidden]'):last");

		MuusioPlayer.playTrack(MuusioPlayer.tracks[$prev.attr('id')]);
	},

	playPause: function(){

		if(MuusioPlayer.currentTrack.playState == 0){
			MuusioPlayer.playTrack(MuusioPlayer.tracks[MuusioPlayer.currentTrack.sID])
		}else if(MuusioPlayer.currentTrack.paused)
			MuusioPlayer.currentTrack.resume(); 
		else{
			MuusioPlayer.currentTrack.pause();
			
		}

		MuusioPlayer.updateTrackNameDisplay();
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
		if(MuusioPlayer.currentTrack != null){
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

			if(((MuusioPlayer.currentTrack.duration - MuusioPlayer.currentTrack.position) / 1000) < 5)
				MuusioPlayer.loadNextTrack();
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

	updateTrackNameDisplay: function(){
		trackName = MuusioPlayer.id3.title;
		trackName += MuusioPlayer.id3.artist ? ' - ' + MuusioPlayer.id3.artist : '';
		trackName += MuusioPlayer.id3.album ? ' - ' + MuusioPlayer.id3.album : '';

		MuusioPlayer.ui.$trackNameDisplay.html(trackName);
	},

	showHideControls: function(){
		if(MuusioPlayer.ui.$hideableControls.css('display') == 'none'){
			MuusioPlayer.ui.$hideableControls.slideDown('fast');
		}else
			MuusioPlayer.ui.$hideableControls.slideUp('fast');
	},

	showHideRightPanel: function(){
		if(parseInt(MuusioPlayer.ui.$rightPanel.css('right')) < 0)
			MuusioPlayer.ui.$rightPanel.animate({right: '0%'});
		else
			MuusioPlayer.ui.$rightPanel.animate({right: '-25%'});
	},

	loadNextTrack: function(){
		nextSongId = MuusioPlayer.getNextSongId();

		if(!nextSongId) return false;

		if(soundManager.sounds[nextSongId]) return true;

		console.log('Loading next track...');

		sound = MuusioPlayer.getSound({file_hash: nextSongId});
		soundManager.play(nextSongId).pause();
	},

	sendPlayingNotification: function(){
		$.ajax({
			url: '/notify',
			type: 'POST',
			data: {'file_hash': MuusioPlayer.currentTrack.sID},
			dataType: 'json',
			success: function(data){
				console.log(data);
			}
		})
	},

	getSavedCurrentTrackId: function(){
		return localStorage.getItem('currentTrackId');
	},

	setSavedCurrentTrackId: function(trackId){
		return localStorage.setItem('currentTrackId', trackId);
	}
}