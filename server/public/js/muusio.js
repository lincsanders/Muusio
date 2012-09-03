jQuery.expr[':'].contains = function(a, i, m) { 
  return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0; 
};

MuusioPlayer = {

	currentTrack: null,
	playlistId: null,
	updateProgressBarTimer: null,
	filterSongListTimer: null,
	fetchNowPlayingInfoTimer: null,
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
		this.bindHotkeys();

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
		localStorage.setItem('queue', newQueue ? JSON.stringify(newQueue) : JSON.stringify([]))
		this.loadQueuedTracksDisplay();
		return true
	},

	getFilterBy: function(){
		return localStorage.getItem('filterBy')
	},

	setFilterBy: function(filterBy){
		return localStorage.setItem('filterBy', filterBy ? filterBy : '');
	},

	getNextSongId: function(popQueue){
		if(this.getQueue().length > 0){
			nextTrackSID = this.getQueue()[0];
			if(popQueue) this.setQueue(this.getQueue().slice(1));
		}else if(!this.currentTrack){
			$next = $("#song-list .track:not('[class*=hidden]'):first");

			nextTrackSID = $next.attr('id');
		} else{

			$next = $("#song-list .track:not('[class*=hidden]')").filter('#'+this.currentTrack.sID).nextAll(":not(.hidden):first");
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

		setTimeout(MuusioPlayer.fetchSongs, 10000);
	},

	setCurrentTrack: function(sound){
		this.id3 = this.tracks[sound.sID].id3;

		this.updateTrackNameDisplay();

		this.currentTrack = sound;
		this.updateProgressBar();
		this.currentTrack.setVolume(this.getVolume());

		this.getNowPlayingInfo();
	},

	playTrack: function(track){
		this.id3 = track.id3;

		prevTrack = this.currentTrack;

		if(soundManager.sounds[track.file_hash]){
			newTrack = soundManager.sounds[track.file_hash]

			if(newTrack.playState != 0)
				newTrack.stop();

			newTrack.play();

			this.setCurrentTrack(newTrack);
		} else {
			sound = this.getSound(track);
			this.setCurrentTrack(soundManager.play(track.file_hash));
		}

		if(prevTrack.sID != this.currentTrack.sID)
			prevTrack.stop();

		this.sendPlayingNotification();

		this.setSavedCurrentTrackId(this.currentTrack.sID)

		//Remove the song from the queue if is is the next song in line to play
		if(this.getQueue()[0] == this.currentTrack.sID)
			this.setQueue(this.getQueue().slice(1));

		this.drawInterface();
	},

	drawTracks: function(){
		var newTrackList=[];
		$.each(this.tracks, function(k,track){
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
		this.sortTracks();

		//Always have a currentTrack
		if(!this.currentTrack){
			this.filterSongList();

			if(this.getSavedCurrentTrackId()) 
				track = this.tracks[this.getSavedCurrentTrackId()];
			else
				track = this.tracks[this.getNextSongId()];

			this.setCurrentTrack(this.getSound(track));
		}

		this.drawInterface();
	},

	drawInterface: function(){
		trackInfo = this.tracks[this.currentTrack.sID];

		if(trackInfo){
			this.ui.$progress.progressbar('option', 'value', 0);
			$('.playing').removeClass('playing');
			$('#'+trackInfo.file_hash).addClass('playing');
		}

		this.ui.$volume.val(this.getVolume())

		this.getPlaylists()

		this.loadQueuedTracksDisplay()
	},

	bindInterface: function(){
		this.ui = {
			$body: $('body'),
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
			$showHideTabs: $('.show-hide-tabs div'),
			$queueDisplay: $('#queue-display'),
			$showHideQueue: $('#show-hide-queue'),
			$hideableControls: $('#hideable-controls'),
			$songListFilter: $('#song-list-filter'),
			$trackNameDisplay: $('#track-name-display'),
			$sortArtist: $('#sort-artist'),
			$sortAlbum: $('#sort-album'),
			$sortTitle: $('#sort-title'),
			$sortRandom: $('#sort-random'),
			$queuedTrackTmpl: $('#queued-track-tmpl'),
			$showAvailableDownloadsButton: $('#show-available-downloads-button'),
			$queueSongList: $('#queue-song-list'),
			$showHideControls: $('#show-hide-controls'),
			$infoDisplayCover: $('#info-display .cover'),
			$infoDisplayText: $('#info-display .text-info'),
			$infoDisplayLoading: $('#info-display .loading'),
			$loadingGif: $('<img src="/img/loading.gif" id="load-gif">'),
			$showHideVolume: $('.show-hide-volume a'),
			$volumeControl: $('.volume-control'),
			$volume: $('.volume-control input'),
			$torrentUrl: $('#torrent-url'),
			$torrentDownload: $('#torrent-download'),
			$playlistTmpl: $('#playlist-tmpl'),
			$playlistList: $('#playlist-display .text-info'),
			$newPlaylistName: $('#new-playlist-name'),
			$newPlaylist: $('#new-playlist')
		}

		ui = this.ui;

		ui.$volume.on('change', function(e){
			MuusioPlayer.setVolume($(this).val())
		})

		//ui.$showHideQueue.resizable({ handles: "e" });

		ui.$playPauseButton.on('click', function(e){
			MuusioPlayer.playPause();
			e.preventDefault(); return false;
		});

		ui.$torrentDownload.on('click', function(e){
			MuusioPlayer.downloadTorrent(ui.$torrentUrl.val());
		})

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

		ui.$showHideVolume.on('click', function(e){
			ui.$volumeControl.toggle();

			e.preventDefault(); return false;	
		})

		ui.$showHideControls.on('click', function(e){
			MuusioPlayer.showHideControls();
			e.preventDefault(); return false;
		})

		ui.$showHideTabs.on('mouseover', function(e){
			$(this).stop();
			$(this).animate({opacity: 1, right: '0px'});
		})

		ui.$showHideTabs.on('mouseleave', function(e){
			$(this).stop();
			$(this).animate({opacity: 0.2, right: '-35px'});
		})

		ui.$showHideTabs.on('click', function(e){
			$this = $(this);
			$display = $('#'+$this.attr('data-display-id'));

			MuusioPlayer.showHideRightDisplay($display, $this);
		})

		ui.$loadingGif.load();

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

		ui.$newPlaylist.on('click', function(e){
			MuusioPlayer.newPlaylist(ui.$newPlaylistName.val())
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
		if(this.ui.$availableSongs.css('display') == 'none'){
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

		this.ui.$availableSongs.toggle();
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
		this.playNext();
	},

	queueTrack: function(sID){
		queue = this.getQueue();
		queue.push(sID)
		this.setQueue(queue);
	},

	playNext: function(){
		nextTrackSID = this.getNextSongId();

		if(nextTrackSID) this.playTrack(this.tracks[nextTrackSID]);
	},

	playPrev: function(){
		$prev = $("#song-list .track:not('[class*=hidden]')").filter('#'+this.currentTrack.sID).prevAll(":not(.hidden):first");

		if($prev.length < 1)
			$prev = $("#song-list .track:not('[class*=hidden]'):last");

		this.playTrack(this.tracks[$prev.attr('id')]);
	},

	playPause: function(){

		if(this.currentTrack.playState == 0){
			this.playTrack(this.tracks[this.currentTrack.sID])
		}else if(this.currentTrack.paused)
			this.currentTrack.resume(); 
		else{
			this.currentTrack.pause();
			
		}

		this.updateTrackNameDisplay();
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
		if(this.currentTrack != null){
			percentageComplete = (this.currentTrack.position / (this.currentTrack.durationEstimate / 100));
			this.ui.$progress.progressbar("option", 'value', percentageComplete);
			d = new Date(this.currentTrack.durationEstimate);
			time = ('0'+d.getMinutes().toString()).substr(-2) + ':' + ('0'+d.getSeconds().toString()).substr(-2)
			if(d.getHours() - 1 > 0) time = ('0'+d.getHours().toString()).substr(-2) + ':' + time
			this.ui.$totalTime.html(time);
			d = new Date(this.currentTrack.position);
			time = ('0'+d.getMinutes().toString()).substr(-2) + ':' + ('0'+d.getSeconds().toString()).substr(-2)
			if(d.getHours() - 1 > 0) time = ('0'+d.getHours().toString()).substr(-2) + ':' + time
			this.ui.$currentTime.html(time);

			if(((this.currentTrack.duration - this.currentTrack.position) / 1000) < 5)
				this.loadNextTrack();
		}

		clearTimeout(this.updateProgressBarTimer);
		this.updatePlayPauseButton();

		this.updateProgressBarTimer = setTimeout('MuusioPlayer.updateProgressBar()', 200);
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
		if(this.sorting == 'song-random'){
			$('div#song-list>div').tsort({order: 'rand'});
		}else if(this.sorting)
			$('div#song-list>div').tsort('.'+this.sorting);
	},

	updatePlayPauseButton: function(){
		this.ui.$playPauseButton.removeClass('play').removeClass('pause');

		if(!this.currentTrack || this.currentTrack.playState == 0 || this.currentTrack.paused){
			this.ui.$playPauseButton.addClass('play');
			this.ui.$playPauseButton.html('►');
		}else {
			this.ui.$playPauseButton.addClass('pause');
			this.ui.$playPauseButton.html('❚❚');
		}
	},

	updateTrackNameDisplay: function(){
		trackName = this.id3.title;
		trackName += this.id3.artist ? ' - ' + this.id3.artist : '';
		trackName += this.id3.album ? ' - ' + this.id3.album : '';

		this.ui.$trackNameDisplay.html(trackName);
	},

	showHideControls: function(){
		if(this.ui.$hideableControls.css('display') == 'none'){
			this.ui.$hideableControls.slideDown('fast');
		}else
			this.ui.$hideableControls.slideUp('fast');
	},

	loadNextTrack: function(){
		nextSongId = this.getNextSongId();

		if(!nextSongId) return false;

		if(soundManager.sounds[nextSongId]) return true;

		console.log('Loading next track...');

		sound = this.getSound({file_hash: nextSongId});
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
	},

	loadQueuedTracksDisplay: function(){
		this.ui.$queueSongList.empty();

		$.each(this.getQueue(), function(k, id){
			track = MuusioPlayer.tracks[id]
			MuusioPlayer.ui.$queuedTrackTmpl.tmpl(track).appendTo(MuusioPlayer.ui.$queueSongList)
		})
	},

	showHideRightDisplay: function($panel, $tab){
		if(parseInt($panel.css('left')) > 100){
			$('.right-panel').not($panel).animate({
				left: '110%'
			})
			$panel.animate({left: '75%'});

			this.ui.$showHideTabs.not($this).animate({opacity: 0.2, right: '-35px'}).removeClass('active-tab')
			$tab.addClass('active-tab');
		} else{
			$panel.animate({left: '110%'});
			this.ui.$showHideTabs.removeClass('active-tab')
		}
	},

	getNowPlayingInfo: function(){
		var ui = this.ui;
		ui.$infoDisplayText.fadeOut('fast');
		ui.$infoDisplayCover.fadeOut('fast', function(){
			ui.$infoDisplayText.empty();
			ui.$infoDisplayLoading.html(MuusioPlayer.ui.$loadingGif).fadeIn();
		});


		clearTimeout(this.fetchNowPlayingInfoTimer);
		this.fetchNowPlayingInfoTimer = setTimeout(MuusioPlayer.fetchNowPlayingInfo, 2000);
	},

	fetchNowPlayingInfo: function(){
		$.get('/info/'+MuusioPlayer.currentTrack.sID)
		.success(function(info){

			$.each(info.id3, function(key, value){
				if(value && value != '')
					ui.$infoDisplayText.append('<strong>'+MuusioPlayer.strToUpper(key)+': </strong><br />'+value+'&nbsp;<br /><br />');
			});

			ui.$infoDisplayLoading.fadeOut('fast', function(){
				if(info.cover_url){
					ui.$infoDisplayCover.attr('src', info.cover_url)
					ui.$infoDisplayCover.fadeIn()
				}

				ui.$infoDisplayText.fadeIn();
			});
		})
	},

	strToUpper: function(str){
	    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	},

	setVolume: function(amount){
		amount = parseInt(amount);
		MuusioPlayer.currentTrack.setVolume(amount);
		localStorage.setItem('volume', amount);
	},

	getVolume: function(){
		v = localStorage.getItem('volume')
		return v === null ? 100 : v;
	},

	downloadTorrent: function(url){
		$.post('/download_torrent', {torrent: url})
		.success(function(data){
			console.log(data);
		})
	},

	getPlaylists: function(){
		$.getJSON('/playlists')
		.success(function(plists){
			MuusioPlayer.drawPlaylists(plists);
		})
	},

	getPlaylistTracks: function(id){
		$.getJSON('/playlist/'+id)
		.success(function(tracks){
			MuusioPlayer.drawPlaylistTracks(id, tracks)	
		})
	},

	drawPlaylists: function(playlists){
		this.ui.$playlistList.empty();

		$.each(playlists, function(k, list){
			playlistEntry = MuusioPlayer.ui.$playlistTmpl.tmpl(list);

			playlistEntry.find('.select').on('click', function(e){
				MuusioPlayer.setCurrentPlaylist($(this).parent().attr('data-id'))
			})

			playlistEntry.find('.delete').on('click', function(e){
				MuusioPlayer.deletePlaylist($(this).parent().attr('data-id'))
			})

			playlistEntry.appendTo(MuusioPlayer.ui.$playlistList)
		})

		if(this.playlistId)
			this.setCurrentPlaylist(this.playlistId);
	},

	drawPlaylistTracks: function(id, tracks){
		var $playlist = $('#playlist_'+id)

		$('.playlist-list-entry .song-list').empty();
			
		$playlist.find('.loading').hide();
		
		$.each(tracks, function(k,track){
			$playlist.find('.song-list').append('<li class="'+track.file_hash+'">'+track.id3.title+'</li>');
		})

		if(tracks.length == 0)
			$playlist.find('.song-list').append('<li>Empty!</li>');

	},

	newPlaylist: function(name){
		if(name){
			$.post('/new_playlist', {name: name})
			.success(function(data){
				MuusioPlayer.ui.$newPlaylistName.val('');
				MuusioPlayer.getPlaylists();
			})
		}
	},

	deletePlaylist: function(id){
		$.getJSON('/playlist/'+id+'/delete')
		.success(function(d){
			MuusioPlayer.getPlaylists();
		})
	},

	addToPlaylist: function(playlistId, fileHash){
		$.post('/add_to_playlist', {playlist_id: playlistId, file_hash: fileHash})
		.success(function(data){
			console.log(data)
			MuusioPlayer.drawPlaylists();
		})
	},

	setCurrentPlaylist: function(id){
		var $playlist;
		if($playlist = $('#playlist_'+id)){
			this.playlistId = id;

			$('.playlist-list-entry .select').removeClass('selected');

			$playlist.find('.select').addClass('selected');
			$loading = $playlist.find('.loading');
			$loading.hide().html(this.ui.$loadingGif).show();

			MuusioPlayer.getPlaylistTracks(id);
		}
	}
}