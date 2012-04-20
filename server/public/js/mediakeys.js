mediaKeysPlugin = {};

(function () {
  if (window.fluid) {
    mediaKeysPlugin.forward = MuusioPlayer.nextTrack;
    mediaKeysPlugin.backward = MuusioPlayer.prevTrack;
    mediaKeysPlugin.play = MuusioPlayer.playPause;
  }
})();