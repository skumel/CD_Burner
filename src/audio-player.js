class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.audio.volume = 0.8;
        this.currentTrack = null;
        this.isPlaying = false;
        this.onTrackChange = null;
        this.onPlaybackStateChange = null;
        this.onTimeUpdate = null;

        this.setupListeners();
    }

    setupListeners() {
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            if (this.onPlaybackStateChange) this.onPlaybackStateChange(true);
        });

        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
        });

        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
        });

        this.audio.addEventListener('timeupdate', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.audio.currentTime, this.audio.duration || 0);
            }
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            this.isPlaying = false;
            if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
        });
    }

    loadTrack(track, autoPlay = true) {
        if (!track || !track.filePath) return;
        this.currentTrack = track;
        
        // Convert Windows file path to file URL safely encoding special characters (#, ?, %, spaces)
        const safeUrl = 'file:///' + track.filePath.replace(/\\/g, '/').split('/').map(segment => {
            return /^[a-zA-Z]:$/.test(segment) ? segment : encodeURIComponent(segment);
        }).join('/');
        this.audio.src = safeUrl;
        this.audio.load();

        if (this.onTrackChange) this.onTrackChange(track);

        if (autoPlay) {
            this.play();
        }
    }

    play() {
        if (this.audio.src) {
            this.audio.play().catch(err => {
                console.warn('Playback error or blocked:', err);
            });
        }
    }

    pause() {
        this.audio.pause();
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
    }

    seek(seconds) {
        if (this.audio.duration) {
            this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration));
        }
    }

    seekRatio(ratio) {
        if (this.audio.duration) {
            this.audio.currentTime = this.audio.duration * Math.max(0, Math.min(1, ratio));
        }
    }

    jumpIntro(seconds = 15) {
        if (this.audio.duration) {
            this.audio.currentTime = Math.min(this.audio.duration - 1, this.audio.currentTime + seconds);
        }
    }

    jumpMidpoint() {
        if (this.audio.duration) {
            this.audio.currentTime = this.audio.duration * 0.5;
        }
    }

    setVolume(volume) {
        this.audio.volume = Math.max(0, Math.min(1, volume));
    }

    setMuted(muted) {
        this.audio.muted = muted;
    }
}

window.audioPlayer = new AudioPlayer();
