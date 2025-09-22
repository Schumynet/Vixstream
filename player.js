// player.js

// ─── CONFIGURAZIONE PROXY E PROGRESS API ─────────────────────────────────────
const PROXY_BASE_URL   = 'https://vixstreamproxy.onrender.com/hls/';
const PROGRESS_API_URL = 'https://vixstreamproxy.onrender.com/progress/save';
const API_URL          = 'https://api.themoviedb.org/3';
const API_KEY          = 'be78689897669066bef6906e501b0e10';

class VideoPlayer {
  constructor() {
    // Stato interno
    this.hls               = null;
    this.content           = null;
    this.currentStreamId   = null;
    this.abortController   = null;
    this.zoomLevel         = 1;
    this.lastTapTime       = 0;
    this.isSeeking         = false;
    this.lastSavedTime     = 0;
    this.lastProgressSave  = 0;
    this.isMobile          = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Riferimenti DOM
    this.videoPlayer        = document.getElementById('videoPlayer');
    this.playerModal        = document.getElementById('player-modal');
    this.loadingOverlay     = document.getElementById('loadingOverlay');
    this.errorOverlay       = document.getElementById('errorOverlay');
    this.errorText          = document.getElementById('errorText');
    this.controlsContainer  = document.getElementById('controlsContainer');
    this.backButtonContainer= document.getElementById('backButtonContainer');
    this.nextEpisodeBtn     = document.getElementById('nextEpisodeBtn');
    this.retryButton        = document.getElementById('retryButton');
    this.playPauseBtn       = document.getElementById('playPauseBtn');
    this.playIcon           = document.getElementById('playIcon');
    this.volumeBtn          = document.getElementById('volumeBtn');
    this.volumeIcon         = document.getElementById('volumeIcon');
    this.volumeSlider       = document.getElementById('volumeSlider');
    this.currentTimeDisplay = document.getElementById('currentTime');
    this.durationDisplay    = document.getElementById('duration');
    this.progressBar        = document.getElementById('progressBar');
    this.progressContainer  = document.getElementById('progressContainer');
    this.fullscreenBtn      = document.getElementById('fullscreenBtn');
    this.zoomBtn            = document.getElementById('zoomBtn');
    this.closePlayerBtn     = document.getElementById('close-player');
    this.skipForward        = document.getElementById('skipForward');
    this.skipBackward       = document.getElementById('skipBackward');
    this.settingsBtn        = document.getElementById('settingsBtn');
    this.audioTrackBtn      = document.getElementById('audioTrackBtn');
    this.captionsBtn        = document.getElementById('captionsBtn');
    this.settingsMenu       = document.getElementById('settingsMenu');
    this.audioMenu          = document.getElementById('audioMenu');
    this.captionsMenu       = document.getElementById('captionsMenu');

    this.initEventListeners();
    this.setupProgressTracking();
  }

  // ─── Avvia la riproduzione ─────────────────────────────────────────────────
  async play(content) {
    this.content = content;
    this.updatePlayerTitle();
    this.playerModal.classList.remove('hidden');
    this.showControlsTemporarily();

    // Carica dati serie TV se necessario
    if (content.media_type === 'tv' && !content.tv_data) {
      try {
        const res = await fetch(`${API_URL}/tv/${content.id}?language=it-IT&api_key=${API_KEY}`);
        content.tv_data = await res.json();
      } catch (err) {
        console.error('Errore TV data:', err);
      }
    }

    this.toggleNextEpisodeButton();
    await this.initPlayer();

    // Riprendi dal punto salvato
    if (content.resumeTime) {
      this.videoPlayer.addEventListener('canplay', () => {
        if (this.videoPlayer.readyState > 0 && this.videoPlayer.duration > 0) {
          this.videoPlayer.currentTime = content.resumeTime;
          this.showResumePrompt(content.resumeTime, this.videoPlayer.duration);
        }
      }, { once: true });
    }
  }

  // ─── Inizializza HLS o lettore nativo ────────────────────────────────────────
  async initPlayer() {
    this.loadingOverlay?.classList.remove('hidden');
    this.errorOverlay?.classList.add('hidden');
    this.currentStreamId = this.generateStreamId();
    this.abortController = new AbortController();

    const proxyUrl = this.buildProxyUrl(this.content);
    try {
      const res = await fetch(proxyUrl, { signal: this.abortController.signal });
      if (!res.ok) throw new Error('Stream fetch failed');
      const { url } = await res.json();

      if (Hls.isSupported()) {
        if (this.hls) this.hls.destroy();
        this.hls = new Hls();
        this.hls.on(Hls.Events.ERROR, (evt, data) => {
          if (data.fatal) {
            this.showError('Errore nel flusso video');
            this.abortController?.abort();
          }
        });

        this.hls.loadSource(url);
        this.hls.attachMedia(this.videoPlayer);

        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
          this.setupQualityOptions();
          this.setupAudioOptions();
          this.setupSubtitleOptions();
          this.setupSpeedOptions();
          this.videoPlayer.play().catch(() => this.showControlsTemporarily());
          this.loadingOverlay?.classList.add('hidden');
        });

      } else {
        this.videoPlayer.src = url;
        this.videoPlayer.addEventListener('loadedmetadata', () => {
          this.loadingOverlay?.classList.add('hidden');
          this.videoPlayer.play();
        }, { once: true });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.showError('Errore nel caricamento del video');
      }
    }
  }

  // ─── Costruzione URL proxy ───────────────────────────────────────────────────
  buildProxyUrl(content) {
    let url = `${PROXY_BASE_URL}movie/${content.id}`;
    if (content.media_type === 'tv') {
      url = `${PROXY_BASE_URL}show/${content.id}/${content.season_number}/${content.episode_number}`;
    }
    return `${url}`;
  }

  // ─── Popola qualità video ────────────────────────────────────────────────────
  setupQualityOptions() {
    const container = this.settingsMenu.querySelector('.quality-options');
    if (!this.hls || !container) return;

    container.innerHTML = `
      <div class="quality-option" data-quality="auto">
        <span>Auto</span>
        <i class="fas fa-check ${this.hls.autoLevelEnabled ? '' : 'hidden'}"></i>
      </div>
    `;
    this.hls.levels.forEach((lvl, idx) => {
      const div = document.createElement('div');
      div.className = 'quality-option';
      div.dataset.quality = idx;
      div.innerHTML = `
        <span>${lvl.height}p</span>
        <i class="fas fa-check ${this.hls.currentLevel === idx ? '' : 'hidden'}"></i>
      `;
      container.appendChild(div);
    });
  }

  // ─── Popola tracce audio ─────────────────────────────────────────────────────
  setupAudioOptions() {
    const container = this.audioMenu.querySelector('.audio-options');
    if (!this.hls || !container) return;

    container.innerHTML = '';
    this.hls.audioTracks.forEach((trk, i) => {
      const div = document.createElement('div');
      div.className = 'audio-option';
      div.dataset.audio = i;
      div.innerHTML = `
        <span>${trk.name||trk.lang||'Audio '+(i+1)}</span>
        <i class="fas fa-check ${this.hls.audioTrack===i?'':'hidden'}"></i>
      `;
      container.appendChild(div);
    });
  }

  // ─── Popola sottotitoli ──────────────────────────────────────────────────────
  setupSubtitleOptions() {
    const container = this.captionsMenu.querySelector('.subtitle-options');
    if (!this.hls || !container) return;

    container.innerHTML = `
      <div class="subtitle-option" data-subtitle="none">
        <span>Disattivati</span>
        <i class="fas fa-check ${this.hls.subtitleTrack===-1?'':'hidden'}"></i>
      </div>
    `;
    this.hls.subtitleTracks.forEach((trk, i) => {
      const div = document.createElement('div');
      div.className = 'subtitle-option';
      div.dataset.subtitle = i;
      div.innerHTML = `
        <span>${trk.name||trk.lang||'Sub '+(i+1)}</span>
        <i class="fas fa-check ${this.hls.subtitleTrack===i?'':'hidden'}"></i>
      `;
      container.appendChild(div);
    });
  }

  // ─── Popola velocità playback ───────────────────────────────────────────────
  setupSpeedOptions() {
    const container = this.settingsMenu.querySelector('.speed-options');
    if (!container) return;

    const speeds = [0.5,1,1.25,1.5,2];
    container.innerHTML = '';
    speeds.forEach(r => {
      const div = document.createElement('div');
      div.className = 'speed-option';
      div.dataset.speed = r;
      div.innerHTML = `
        <span>${r}x</span>
        <i class="fas fa-check ${this.videoPlayer.playbackRate===r?'':'hidden'}"></i>
      `;
      container.appendChild(div);
    });
  }

  // ─── Utility ────────────────────────────────────────────────────────────────
  generateStreamId() {
    return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
  }

  showError(msg) {
    this.loadingOverlay?.classList.add('hidden');
    this.errorOverlay?.classList.remove('hidden');
    this.errorText.textContent = msg;
    this.abortController?.abort();
  }

  updatePlayerTitle() {
    let t = this.content.title||this.content.name||'Senza Titolo';
    if (this.content.media_type==='tv') {
      const e = this.content.episode_data?.name||`Episodio ${this.content.episode_number}`;
      t = `${this.content.name} - S${String(this.content.season_number).padStart(2,'0')}E${String(this.content.episode_number).padStart(2,'0')}: ${e}`;
    }
    document.getElementById('player-title').textContent = t;
  }

  // ─── Controlli standard ─────────────────────────────────────────────────────
  togglePlayPause() { this.videoPlayer.paused ? this.videoPlayer.play() : this.videoPlayer.pause(); }
  updatePlayIcon(isPlaying) { this.playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play'; }
  toggleMute() {
    if (this.videoPlayer.volume === 0) {
      this.videoPlayer.volume = 1; this.volumeSlider.value = 1; this.volumeIcon.className = 'fas fa-volume-up';
    } else {
      this.videoPlayer.volume = 0; this.volumeSlider.value = 0; this.volumeIcon.className = 'fas fa-volume-mute';
    }
  }
  updateVolume(v) {
    this.videoPlayer.volume = v;
    this.volumeIcon.className = v == 0 ? 'fas fa-volume-mute'
      : v < 0.5 ? 'fas fa-volume-down'
      : 'fas fa-volume-up';
  }
  updateTimeDisplay() {
    const fmt = sec => `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
    this.currentTimeDisplay.textContent = fmt(this.videoPlayer.currentTime);
    this.durationDisplay.textContent = fmt(this.videoPlayer.duration);
    this.progressBar.style.width = `${(this.videoPlayer.currentTime / this.videoPlayer.duration) * 100}%`;
  }

  // ─── Seek manuale ───────────────────────────────────────────────────────────
  startSeek(e)   { this.isSeeking = true; this.handleSeek(e); }
  handleSeek(e)  {
    if (!this.isSeeking) return;
    const x = e.clientX || e.touches?.[0].clientX;
    const rect = this.progressContainer.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    this.videoPlayer.currentTime = pct * this.videoPlayer.duration;
  }
  endSeek()      { this.isSeeking = false; }

  // ─── Touch gestures ─────────────────────────────────────────────────────────
  handleTouchStart(e) { this.touchStartX = e.touches[0].clientX; this.touchStartTime = Date.now(); }
  handleTouchEnd(e) {
    const x = e.changedTouches[0].clientX;
    const w = this.videoPlayer.offsetWidth;
    const now = Date.now();
    if (now - this.lastTapTime < 300) {
      x/w > 0.6 ? this.doSkipForward() : x/w < 0.4 ? this.doSkipBackward() : this.togglePlayPause();
      this.lastTapTime = 0;
      return;
    }
    this.lastTapTime = now;
  }
  doSkipForward()  { this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + 10); }
  doSkipBackward() { this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - 10); }

  // ─── Zoom & Fullscreen ──────────────────────────────────────────────────────
  toggleZoom() {
    this.zoomLevel = this.zoomLevel < 3 ? this.zoomLevel + 1 : 1;
    const modes = ['contain','cover','fill'];
    this.videoPlayer.style.objectFit = modes[this.zoomLevel - 1];
  }
  isFullscreen() {
    const c = document.getElementById('videoContainer');
    return !!(document.fullscreenElement === c);
  }
  toggleFullscreen() {
    const c = document.getElementById('videoContainer');
    if (!this.isFullscreen()) {
      c.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  // ─── Menu interazioni ───────────────────────────────────────────────────────
  toggleMenu(type) {
    this.settingsMenu.classList.toggle('active', type === 'settings');
    this.audioMenu.classList.toggle('active', type === 'audio');
    this.captionsMenu.classList.toggle('active', type === 'captions');
  }
  handleMenuSelection(e) {
    const q = e.target.closest('.quality-option');
    if (q) this.hls.currentLevel = q.dataset.quality === 'auto' ? -1 : parseInt(q.dataset.quality);

    const a = e.target.closest('.audio-option');
    if (a) this.hls.audioTrack = parseInt(a.dataset.audio);

    const s = e.target.closest('.subtitle-option');
    if (s) this.hls.subtitleTrack = s.dataset.subtitle === 'none' ? -1 : parseInt(s.dataset.subtitle);

    const sp = e.target.closest('.speed-option');
    if (sp) this.videoPlayer.playbackRate = parseFloat(sp.dataset.speed);

    this.settingsMenu.classList.remove('active');
    this.audioMenu.classList.remove('active');
    this.captionsMenu.classList.remove('active');
  }

  // ─── Controlli visibilità ───────────────────────────────────────────────────
  showControlsTemporarily() {
    this.controlsContainer.classList.add('visible');
    clearTimeout(this._hideControls);
    this._hideControls = setTimeout(() => {
      if (!this.videoPlayer.paused && !this.isSeeking) {
        this.controlsContainer.classList.remove('visible');
      }
    }, 3000);
  }

  initEventListeners() {
    this.retryButton.addEventListener('click', () => this.initPlayer());
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.videoPlayer.addEventListener('play', () => this.updatePlayIcon(true));
    this.videoPlayer.addEventListener('pause', () => this.updatePlayIcon(false));
    this.volumeBtn.addEventListener('click', () => this.toggleMute());
    this.volumeSlider.addEventListener('input', e => this.updateVolume(e.target.value));
    this.videoPlayer.addEventListener('timeupdate', () => this.updateTimeDisplay());
    this.progressContainer.addEventListener('mousedown', e => this.startSeek(e));
    document.addEventListener('mousemove', e => this.handleSeek(e));
    document.addEventListener('mouseup', () => this.endSeek());
    this.videoPlayer.addEventListener('touchstart', e => this.handleTouchStart(e));
    this.videoPlayer.addEventListener('touchend', e => this.handleTouchEnd(e));
    this.skipForward.addEventListener('click', () => this.doSkipForward());
    this.skipBackward.addEventListener('click', () => this.doSkipBackward());
    this.zoomBtn.addEventListener('click', () => this.toggleZoom());
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    this.closePlayerBtn.addEventListener('click', () => this.closePlayer());
    this.settingsBtn.addEventListener('click', () => this.toggleMenu('settings'));
    this.audioTrackBtn.addEventListener('click', () => this.toggleMenu('audio'));
    this.captionsBtn.addEventListener('click', () => this.toggleMenu('captions'));
    document.addEventListener('click', e => this.handleMenuSelection(e));
    this.videoPlayer.addEventListener('mousemove', () => this.showControlsTemporarily());
  }

  // ─── Progress Tracking ─────────────────────────────────────────────────────
  setupProgressTracking() {
    this.videoPlayer.addEventListener('timeupdate', () => {
      const t = Math.floor(this.videoPlayer.currentTime);
      if (!this.videoPlayer.paused && t % 30 === 0 && t !== this.lastSavedTime) {
        this.savePlaybackProgress();
        this.lastSavedTime = t;
      }
    });
    this.videoPlayer.addEventListener('pause', () => this.savePlaybackProgress());
  }

  async savePlaybackProgress() {
    const now = Date.now();
    if (now - this.lastProgressSave < 1000) return;
    const d = this.videoPlayer.duration;
    if (!this.content || !d) return;

    const c = this.videoPlayer.currentTime;
    const pct = (c / d) * 100;
    if (pct < 5 || pct > 95) return;

    const ip = await this.getClientIP();
    const payload = {
      ip,
      tmdbId: this.content.id,
      contentType: this.content.media_type,
      season: this.content.season_number || null,
      episode: this.content.episode_number || null,
      currentTime: c,
      duration: d,
      title: this.content.title
    };

    navigator.sendBeacon
      ? navigator.sendBeacon(PROGRESS_API_URL, JSON.stringify(payload))
      : fetch(PROGRESS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        });

    this.lastProgressSave = now;
  }

  async getClientIP() {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      return (await r.json()).ip;
    } catch {
      return `anon-${navigator.userAgent.slice(0, 10)}-${Date.now()}`;
    }
  }

  // ─── Next Episode ──────────────────────────────────────────────────────────
  toggleNextEpisodeButton() {
    if (this.content.media_type === 'tv' && this.content.season_number && this.content.episode_number) {
      this.nextEpisodeBtn.style.display = this.checkNextEpisodeExists() ? 'flex' : 'none';
    } else {
      this.nextEpisodeBtn.style.display = 'none';
    }
  }

  checkNextEpisodeExists() {
    if (!this.content.tv_data) return false;
    const season = this.content.tv_data.seasons.find(s => s.season_number === this.content.season_number);
    if (!season) return false;
    if (this.content.episode_number < season.episode_count) return true;
    return this.content.tv_data.seasons.some(s => s.season_number === this.content.season_number + 1);
  }

  async playNextEpisode() {
    if (!this.checkNextEpisodeExists()) return;
    let s = this.content.season_number,
        e = this.content.episode_number + 1;
    const season = this.content.tv_data.seasons.find(s => s.season_number === this.content.season_number);
    if (e > season.episode_count) { s++; e = 1; }
    if (!this.content.tv_data.seasons.some(s2 => s2.season_number === s)) return;

    this.hls?.destroy();
    this.videoPlayer.pause();
    this.videoPlayer.removeAttribute('src');
    this.videoPlayer.load();

    this.content = { ...this.content, season_number: s, episode_number: e, episode_data: null };
    this.updatePlayerTitle();
    this.toggleNextEpisodeButton();
    await this.initPlayer();
  }

  showResumePrompt(time, duration) {
    const m = Math.floor(time / 60),
          s = String(Math.floor(time % 60)).padStart(2, '0');
    const prompt = document.createElement('div');
    prompt.className = 'resume-prompt';
    prompt.innerHTML = `
      <div class="prompt-content">
        <p>Riprendi da ${m}:${s}?</p>
        <button class="resume-yes">Continua</button>
        <button class="resume-no">Ricomincia</button>
      </div>`;
    document.getElementById('videoContainer').appendChild(prompt);
    prompt.querySelector('.resume-yes').onclick = () => prompt.remove();
    prompt.querySelector('.resume-no').onclick = () => { this.videoPlayer.currentTime = 0; prompt.remove(); };
    setTimeout(() => prompt.remove(), 10000);
  }

  // ─── Close Player ──────────────────────────────────────────────────────────
  async closePlayer() {
    await this.savePlaybackProgress();
    this.abortController?.abort();
    this.hls?.destroy();
    this.videoPlayer.pause();
    this.videoPlayer.removeAttribute('src');
    this.videoPlayer.load();
    this.playerModal.classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen();
  }
}

// ─── ISTANZA E FUNZIONE DI AVVIO ─────────────────────────────────────────────
const videoPlayerInstance = new VideoPlayer();

function playMovie(content, type = null) {
  if (typeof content === 'number') {
    content = { id: content, media_type: type || 'movie', title: 'Film' };
  }
  if (typeof content === 'string' && content.includes('-')) {
    const [tvId, season, episode] = content.split('-');
    const epData = episodeMap.get(content);
    if (!epData) { console.error('Episodio sconosciuto'); return; }
    content = {
      id: parseInt(tvId),
      media_type: 'tv',
      name: epData.tvData.name,
      title: epData.tvData.name,
      season_number: parseInt(season),
      episode_number: parseInt(episode),
      episode_data: epData.episodeData,
      tv_data: epData.tvData
    };
  }
  if (content.media_type === 'tv' && (!content.season_number || !content.episode_number)) {
    showTVSeasons(content.id, 'tv');
    return;
  }
  videoPlayerInstance.play(content);
  if (content.media_type === 'tv') {
    window.lastPlayedTV = { id: content.id, season: content.season_number };
  }
}