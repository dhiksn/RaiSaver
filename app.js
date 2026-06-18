// ===== Config =====
const DEFAULT_BACKEND_URL = window.location.protocol === 'https:' ? '/api' : 'http://node4.dayy.web.id:5536';
const LOCAL_BACKEND_URL = 'http://127.0.0.1:8000';

function getBackendUrl() {
  return sessionStorage.getItem('backendUrl')
      || localStorage.getItem('backendUrl')
      || DEFAULT_BACKEND_URL;
}

function setBackendUrl(url) {
  const clean = url.replace(/\/$/, '');
  localStorage.setItem('backendUrl', clean);
  sessionStorage.setItem('backendUrl', clean);
  updateBackendBadge();
}

function getBackendMode() {
  const url = getBackendUrl();
  if (url === LOCAL_BACKEND_URL) return 'local';
  if (url === DEFAULT_BACKEND_URL) return 'remote';
  return 'custom';
}

function updateBackendBadge() {
  const mode = getBackendMode();
  const labelMap = { local: 'LOCAL', remote: 'REMOTE', custom: 'CUSTOM' };

  // FAB dot
  const dot = document.getElementById('fabModeDot');
  if (dot) { dot.className = `fab-mode-dot ${mode}`; }

  // Modal badge
  const badge = document.getElementById('backendModeBadge');
  if (badge) {
    badge.className = `backend-mode-badge ${mode}`;
    badge.textContent = labelMap[mode];
  }

  // Quick btn active state
  document.getElementById('btnLocal')?.classList.toggle('active', mode === 'local');
  document.getElementById('btnRemote')?.classList.toggle('active', mode === 'remote');
}

// ===== State =====
let currentPlatform = 'youtube';
let videoInfo = null;
let selectedFormatId = null;
let isDownloading = false;
let progressInterval = null;

// ===== DOM refs =====
const urlInput       = document.getElementById('urlInput');
const fetchBtn       = document.getElementById('fetchBtn');
const loadingState   = document.getElementById('loadingState');
const errorCard      = document.getElementById('errorCard');
const errorText      = document.getElementById('errorText');
const videoCard      = document.getElementById('videoCard');
const progressCard   = document.getElementById('progressCard');

// ===== Platform Tabs =====
document.querySelectorAll('.nav-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentPlatform = btn.dataset.platform;
    document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update placeholder
    const placeholders = {
      youtube:   'Paste link YouTube di sini...',
      tiktok:    'Paste link TikTok di sini...',
      instagram: 'Paste link Instagram di sini...',
    };
    urlInput.placeholder = placeholders[currentPlatform];

    // Update hero text
    const heroTitles = {
      youtube:   { main: 'Unduh YouTube',   sub: 'No Watermark' },
      tiktok:    { main: 'Unduh TikTok',    sub: 'No Watermark' },
      instagram: { main: 'Unduh Instagram', sub: 'No Watermark' },
    };
    const t = heroTitles[currentPlatform];
    const titleEl  = document.querySelector('.hero-title');
    const titleMain = document.getElementById('heroTitleMain');
    const titleSub  = document.getElementById('heroTitleSub');
    const heroDesc  = document.getElementById('heroDesc');
    if (titleEl) titleEl.classList.add('title-sm');
    if (titleMain) titleMain.textContent = t.main;
    if (titleSub)  titleSub.textContent  = t.sub;

    const descs = {
      youtube:   'Download video YouTube dalam kualitas terbaik, gratis dan cepat.',
      tiktok:    'Download video TikTok tanpa watermark, langsung ke perangkat kamu.',
      instagram: 'Download Reels & foto Instagram dengan mudah dan cepat.',
    };
    if (heroDesc) heroDesc.textContent = descs[currentPlatform];

    // Reset UI
    resetVideoUI();
  });
});

// ===== Enter key =====
urlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') fetchInfo();
});

// ===== Fetch Info =====
async function fetchInfo() {
  const url = urlInput.value.trim();
  if (!url) return;

  // Validate URL vs platform
  const isYT  = url.includes('youtube.com') || url.includes('youtu.be');
  const isTT  = url.includes('tiktok.com') || url.includes('vt.tiktok.com');
  const isIG  = url.includes('instagram.com');

  if (currentPlatform === 'youtube' && !isYT) {
    return showError(
      isTT ? 'This is a TikTok link! Switch to the TikTok tab.' :
      isIG ? 'This is an Instagram link! Switch to the Instagram tab.' :
             'Please paste a valid YouTube link.'
    );
  }
  if (currentPlatform === 'tiktok' && !isTT) {
    return showError(
      isYT ? 'This is a YouTube link! Switch to the YouTube tab.' :
      isIG ? 'This is an Instagram link! Switch to the Instagram tab.' :
             'Please paste a valid TikTok link.'
    );
  }
  if (currentPlatform === 'instagram' && !isIG) {
    return showError('Please paste a valid Instagram link (Reels, post, etc.).');
  }

  resetVideoUI();
  showLoading(true);
  hideError();

  try {
    let endpoint;
    if (currentPlatform === 'tiktok')    endpoint = `${getBackendUrl()}/tiktok/info?url=${encodeURIComponent(url)}`;
    else if (currentPlatform === 'instagram') endpoint = `${getBackendUrl()}/instagram/info?url=${encodeURIComponent(url)}`;
    else                                  endpoint = `${getBackendUrl()}/info?url=${encodeURIComponent(url)}`;

    const res = await fetch(endpoint);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || `Server error ${res.status}`);
    }

    videoInfo = data;
    selectedFormatId = data.video_formats?.[0]?.format_id ?? null;
    renderVideoCard(data);
  } catch (err) {
    showError(err.message || 'Failed to connect to backend.');
  } finally {
    showLoading(false);
  }
}

// ===== Render Video Card =====
function renderVideoCard(data) {
  const isTikTokVideo = currentPlatform === 'tiktok' && !data.is_photo;
  const thumbnailWrapper  = document.getElementById('thumbnailWrapper');
  const tiktokPlayerWrap  = document.getElementById('tiktokPlayerWrapper');
  const tiktokPlayer      = document.getElementById('tiktokPlayer');

  // --- TikTok VIDEO: show inline player, hide thumbnail ---
  if (isTikTokVideo) {
    thumbnailWrapper.style.display = 'none';
    tiktokPlayerWrap.style.display = 'block';

    // Use HD url first, fallback to SD
    const hdFmt = data.video_formats?.find(f => f.format_id === 'hd');
    const sdFmt = data.video_formats?.find(f => f.format_id === 'sd');
    const playerSrc = (hdFmt || sdFmt)?.download_url || '';

    tiktokPlayer.src = playerSrc;
    tiktokPlayer.load();

  } else {
    // --- Thumbnail for everything else (YouTube, Instagram, TikTok photo) ---
    tiktokPlayerWrap.style.display = 'none';

    // Stop & clear any previous TikTok player
    tiktokPlayer.pause();
    tiktokPlayer.src = '';

    const thumb = document.getElementById('videoThumbnail');
    if (data.thumbnail) {
      // Proxy all thumbnails through our backend to avoid CORS/mixed-content issues
      const backendBase = window.location.protocol === 'https:' ? '/api' : 'http://node4.dayy.web.id:5536';
      const src = `${backendBase}/proxy-image?url=${encodeURIComponent(data.thumbnail)}`;
      thumb.src = src;
      thumb.style.display = 'block';
      thumbnailWrapper.style.display = 'block';
    } else {
      thumbnailWrapper.style.display = 'none';
    }

    // Duration badge
    const dur = document.getElementById('durationBadge');
    if (data.duration) {
      dur.textContent = formatDuration(data.duration);
      dur.style.display = 'inline';
    } else {
      dur.style.display = 'none';
    }
  }

  // Title & channel
  document.getElementById('videoTitle').textContent   = data.title   || 'Unknown Title';
  document.getElementById('videoChannel').textContent = data.channel || 'Unknown';

  // Caption Instagram (expandable)
  const captionWrap = document.getElementById('captionWrap');
  const captionText = document.getElementById('captionText');
  const captionToggle = document.getElementById('captionToggle');
  if (currentPlatform === 'instagram' && data.description) {
    let desc = data.description.trim();
    // Hapus baris pertama kalau sama dengan title
    const firstLine = desc.split('\n')[0].trim();
    if (firstLine === (data.title || '').trim()) {
      desc = desc.substring(firstLine.length).trimStart();
    }
    if (desc) {
      captionText.textContent = desc;
      captionText.classList.remove('expanded');
      captionToggle.textContent = 'Selengkapnya';
      captionWrap.style.display = 'block';

      // Hide 'Selengkapnya' if text is short
      const lines = desc.split('\n').length;
      if (desc.length > 150 || lines > 3) {
        captionToggle.style.display = 'inline-block';
      } else {
        captionToggle.style.display = 'none';
      }
    } else {
      captionWrap.style.display = 'none';
    }
  } else {
    captionWrap.style.display = 'none';
  }

  // Low-res warning (YouTube only)
  const lowResWarn = document.getElementById('lowResWarning');
  if (currentPlatform === 'youtube' && data.video_formats?.length) {
    const hasHighRes = data.video_formats.some(f => parseInt(f.resolution) >= 480);
    if (!hasHighRes) {
      document.getElementById('lowResText').textContent =
        `YouTube is blocking higher resolutions. Only ${data.video_formats[0].resolution} available.`;
      lowResWarn.style.display = 'flex';
    } else {
      lowResWarn.style.display = 'none';
    }
  } else {
    lowResWarn.style.display = 'none';
  }

  // Format select
  const select = document.getElementById('formatSelect');
  select.innerHTML = '';
  (data.video_formats || []).forEach(fmt => {
    const opt = document.createElement('option');
    opt.value = fmt.format_id;
    const ext = (fmt.ext || 'mp4').toUpperCase();
    opt.textContent = `${fmt.resolution} — ${ext}`;
    select.appendChild(opt);
  });
  select.value = selectedFormatId;
  select.addEventListener('change', () => {
    selectedFormatId = select.value;
    updateDownloadBtnLabel();
    // If TikTok video, swap player src when user switches HD/SD
    if (isTikTokVideo) {
      const fmt = data.video_formats?.find(f => f.format_id === selectedFormatId);
      if (fmt?.download_url) {
        const wasPaused = tiktokPlayer.paused;
        const currentTime = tiktokPlayer.currentTime;
        tiktokPlayer.src = fmt.download_url;
        tiktokPlayer.load();
        tiktokPlayer.currentTime = currentTime;
        if (!wasPaused) tiktokPlayer.play().catch(() => {});
      }
    }
  });
  updateDownloadBtnLabel();

  // Audio section (YouTube & TikTok)
  const audioSec = document.getElementById('audioSection');
  if (currentPlatform === 'youtube' || (currentPlatform === 'tiktok' && !data.is_photo)) {
    audioSec.style.display = 'block';
    document.getElementById('audioDownloadLabel').textContent = currentPlatform === 'youtube' ? 'Download M4A' : 'Download MP3';
  } else {
    audioSec.style.display = 'none';
  }

  // Download All section (carousel/slideshow)
  const dlAllSection = document.getElementById('downloadAllSection');
  const dlAllCount   = document.getElementById('downloadAllCount');
  const fmts = data.video_formats || [];
  const hasApi  = fmts.some(f => f.format_id?.startsWith('api_'));
  const hasImg  = fmts.some(f => f.format_id?.startsWith('img_'));
  const showAll = (currentPlatform === 'instagram' && hasApi && fmts.length > 1)
               || (currentPlatform === 'tiktok'    && hasImg && fmts.length > 1);
  if (showAll) {
    dlAllCount.textContent = `${fmts.length} item akan diunduh sebagai ZIP`;
    dlAllSection.style.display = 'block';
  } else {
    dlAllSection.style.display = 'none';
  }

  videoCard.style.display = 'block';
  document.querySelector('.result-inner').classList.add('has-content');
}

function updateDownloadBtnLabel() {
  if (!videoInfo || !selectedFormatId) return;
  const fmt = videoInfo.video_formats?.find(f => f.format_id == selectedFormatId);
  if (!fmt) return;

  const ext = (fmt.ext || 'mp4').toUpperCase();
  const isImage = ['JPG','JPEG','PNG'].includes(ext);

  const icon = document.getElementById('downloadVideoIcon');
  const label = document.getElementById('downloadVideoLabel');

  label.textContent = ext;

  if (isImage) {
    icon.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>';
  } else {
    icon.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';
  }
}

// ===== Download Video =====
function downloadVideo() {
  if (isDownloading || !videoInfo) return;
  const url = urlInput.value.trim();
  const taskId = Date.now().toString();

  // Check if this format has a direct download_url (TikTok/Instagram CDN)
  const fmt = videoInfo.video_formats?.find(f => f.format_id == selectedFormatId);
  const isDirectUrl = !!fmt?.download_url;

  let endpoint;
  if (currentPlatform === 'tiktok') {
    endpoint = `${getBackendUrl()}/tiktok/download?url=${encodeURIComponent(url)}&format_id=${selectedFormatId}&task_id=${taskId}`;
  } else if (currentPlatform === 'instagram') {
    endpoint = `${getBackendUrl()}/instagram/download?url=${encodeURIComponent(url)}&format_id=${selectedFormatId}&task_id=${taskId}`;
  } else {
    endpoint = `${getBackendUrl()}/download/video?url=${encodeURIComponent(url)}&format_id=${selectedFormatId}&task_id=${taskId}`;
  }

  // Open in new tab IMMEDIATELY (must be synchronous from click event to avoid popup block)
  window.open(endpoint, '_blank', 'noopener,noreferrer');

  if (isDirectUrl) {
    // Direct CDN download — no backend processing, just show brief feedback
    startDirectDownloadFeedback();
  } else {
    startProgressPolling(taskId);
  }
}

// ===== Download Audio =====
function downloadAudio() {
  if (isDownloading || !videoInfo) return;
  const url = urlInput.value.trim();
  const taskId = Date.now().toString();
  let endpoint;
  
  if (currentPlatform === 'tiktok') {
    endpoint = `${getBackendUrl()}/tiktok/download/mp3?url=${encodeURIComponent(url)}&task_id=${taskId}`;
  } else {
    endpoint = `${getBackendUrl()}/download/audio?url=${encodeURIComponent(url)}&task_id=${taskId}`;
  }

  // Open in new tab IMMEDIATELY (must be synchronous from click event to avoid popup block)
  window.open(endpoint, '_blank', 'noopener,noreferrer');
  startProgressPolling(taskId);
}

// ===== Direct Download Feedback (TikTok/Instagram CDN — no backend polling) =====
function startDirectDownloadFeedback() {
  isDownloading = true;
  setDownloadBtnsDisabled(true);
  showProgress(true);
  updateProgress(1, 'Download dimulai! Cek folder Downloads kamu.', '', '');
  document.querySelector('.result-inner').classList.add('has-content');

  setTimeout(() => {
    showProgress(false);
    isDownloading = false;
    setDownloadBtnsDisabled(false);
  }, 3000);
}

// ===== Progress Polling (UI only, download handled by window.open) =====
function startProgressPolling(taskId) {
  isDownloading = true;
  setDownloadBtnsDisabled(true);
  showProgress(true);
  updateProgressIndeterminate('Preparing download...');

  let completed = false;

  progressInterval = setInterval(async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/progress?task_id=${taskId}`);
      const data = await res.json();
      const status = data.status || 'starting';
      const prog   = parseFloat(data.progress || 0);
      const speed  = data.speed  || '';
      const total  = data.total  || '';

      if (status === 'downloading') {
        updateProgress(prog, 'Mengunduh', total, speed);
      } else if (status === 'processing') {
        updateProgressIndeterminate('Menggabungkan video & audio...');
      } else if (status === 'completed') {
        completed = true;
        clearInterval(progressInterval);
        updateProgress(1, 'Selesai! Cek folder Downloads kamu.', '', '');
        setTimeout(() => {
          showProgress(false);
          isDownloading = false;
          setDownloadBtnsDisabled(false);
        }, 3000);
      }
    } catch (_) {}
  }, 1000);

  // Safety timeout: stop spinner after 15 min max
  setTimeout(() => {
    if (!completed) {
      clearInterval(progressInterval);
      showProgress(false);
      isDownloading = false;
      setDownloadBtnsDisabled(false);
    }
  }, 15 * 60 * 1000);
}

// ===== Core Download (kept for reference) =====
async function startDownload(endpoint, taskId) {
  window.open(endpoint, '_blank', 'noopener,noreferrer');
  startProgressPolling(taskId);
}

// ===== Trigger browser download (kept for reference, not used for main flow) =====
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ===== UI Helpers =====
function showLoading(show) {
  loadingState.style.display = show ? 'flex' : 'none';
  document.querySelector('.result-inner').classList.toggle('has-content', show);
}

function showError(msg) {
  errorText.textContent = msg;
  errorCard.style.display = 'flex';
  document.querySelector('.result-inner').classList.add('has-content');
}

function hideError() {
  errorCard.style.display = 'none';
}

function resetVideoUI() {
  videoCard.style.display = 'none';
  hideError();
  document.querySelector('.result-inner').classList.remove('has-content');
  videoInfo = null;
  selectedFormatId = null;
  // Clean up TikTok player
  const tiktokPlayer = document.getElementById('tiktokPlayer');
  if (tiktokPlayer) {
    tiktokPlayer.pause();
    tiktokPlayer.src = '';
  }
}

function showProgress(show) {
  progressCard.style.display = show ? 'flex' : 'none';
}

function updateProgress(value, statusMsg, total = '', speed = '') {
  const fill = document.getElementById('progressFill');
  const pct  = document.getElementById('progressPercent');
  const stat = document.getElementById('progressStatus');
  const tot  = document.getElementById('progressTotal');
  const spd  = document.getElementById('progressSpeed');

  fill.classList.remove('indeterminate');
  fill.style.width = `${Math.round(value * 100)}%`;
  pct.textContent  = `${Math.round(value * 100)}%`;
  stat.textContent = statusMsg;
  if (tot) tot.textContent = total;
  if (spd) { spd.textContent = speed; spd.style.display = speed ? 'inline-flex' : 'none'; }
}

function updateProgressIndeterminate(statusMsg) {
  const fill = document.getElementById('progressFill');
  const pct  = document.getElementById('progressPercent');
  const stat = document.getElementById('progressStatus');
  const spd  = document.getElementById('progressSpeed');
  const tot  = document.getElementById('progressTotal');

  fill.classList.add('indeterminate');
  pct.textContent  = '—';
  stat.textContent = statusMsg;
  if (tot) tot.textContent = '';
  if (spd) spd.style.display = 'none';
}

function setDownloadBtnsDisabled(disabled) {
  document.getElementById('downloadVideoBtn').disabled = disabled;
  const audioBtn = document.querySelector('#audioSection .download-btn');
  if (audioBtn) audioBtn.disabled = disabled;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ===== Settings Modal =====
function openSettings() {
  document.getElementById('settingsBackendUrl').value = getBackendUrl();
  document.getElementById('settingsModal').style.display = 'flex';
  updateBackendBadge();
}

function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveSettings() {
  const val = document.getElementById('settingsBackendUrl').value.trim();
  if (!val) return;
  setBackendUrl(val);
  closeSettings();
  showToast('Backend URL disimpan!');
}

function useLocal() {
  document.getElementById('settingsBackendUrl').value = LOCAL_BACKEND_URL;
  setBackendUrl(LOCAL_BACKEND_URL);
  updateBackendBadge();
  showToast('Beralih ke Local backend');
}

function useRemote() {
  document.getElementById('settingsBackendUrl').value = DEFAULT_BACKEND_URL;
  setBackendUrl(DEFAULT_BACKEND_URL);
  updateBackendBadge();
  showToast('Beralih ke Remote backend');
}

// ===== Caption Toggle =====
function toggleCaption() {
  const text   = document.getElementById('captionText');
  const toggle = document.getElementById('captionToggle');
  const expanded = text.classList.toggle('expanded');
  toggle.textContent = expanded ? 'Lebih sedikit' : 'Selengkapnya';
}

// ===== Download All (carousel/slideshow ZIP) =====
function downloadAll() {
  if (isDownloading || !videoInfo) return;
  const url    = urlInput.value.trim();
  const taskId = Date.now().toString();
  let endpoint;

  if (currentPlatform === 'instagram') {
    endpoint = `${getBackendUrl()}/instagram/download/all?url=${encodeURIComponent(url)}&task_id=${taskId}`;
  } else if (currentPlatform === 'tiktok') {
    endpoint = `${getBackendUrl()}/tiktok/download/all?url=${encodeURIComponent(url)}&task_id=${taskId}`;
  } else return;

  window.open(endpoint, '_blank', 'noopener,noreferrer');
  startProgressPolling(taskId);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// Close modal on backdrop click
document.getElementById('settingsModal').addEventListener('click', function(e) {
  if (e.target === this) closeSettings();
});

// Init badge saat load
updateBackendBadge();
