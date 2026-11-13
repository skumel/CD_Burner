// STATE MANAGEMENT
const state = {
    mode: 'audio', // 'audio' or 'data'
    songs: [],
    selectedSongIds: new Set(),
    activeSort: { column: null, ascending: true },
    currentFilter: 'all', // 'all', 'selected', 'unselected'
    searchQuery: '',
    storageDrives: [],
    opticalDrives: [],
    selectedRecorderIndex: 0,
    isScanning: false,
    audioTrackOrder: [] // IDs in specific audio track order
};

// DOM ELEMENTS
const dom = {
    // Mode
    modeAudioBtn: document.getElementById('modeAudioBtn'),
    modeDataBtn: document.getElementById('modeDataBtn'),
    
    // Drive & Header
    opticalDriveSelect: document.getElementById('opticalDriveSelect'),
    refreshDrivesBtn: document.getElementById('refreshDrivesBtn'),
    openEraseModalBtn: document.getElementById('openEraseModalBtn'),
    openCoverModalBtn: document.getElementById('openCoverModalBtn'),
    storageDrivesList: document.getElementById('storageDrivesList'),
    
    // Sidebar Folders & Scan
    scanMusicFolderBtn: document.getElementById('scanMusicFolderBtn'),
    scanDownloadsFolderBtn: document.getElementById('scanDownloadsFolderBtn'),
    scanCustomFolderBtn: document.getElementById('scanCustomFolderBtn'),
    scanStatusText: document.getElementById('scanStatusText'),
    cancelScanBtn: document.getElementById('cancelScanBtn'),
    scanProgressContainer: document.getElementById('scanProgressContainer'),
    scanDetails: document.getElementById('scanDetails'),

    // Disc Settings
    discTitleInput: document.getElementById('discTitleInput'),
    discArtistInput: document.getElementById('discArtistInput'),
    gapControlSelect: document.getElementById('gapControlSelect'),
    normalizeAudioCheckbox: document.getElementById('normalizeAudioCheckbox'),
    ejectCheckbox: document.getElementById('ejectCheckbox'),
    testRunCheckbox: document.getElementById('testRunCheckbox'),
    speedSelect: document.getElementById('speedSelect'),

    // Toolbar
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    autoFitBtn: document.getElementById('autoFitBtn'),
    saveIsoBtn: document.getElementById('saveIsoBtn'),
    startBurnBtn: document.getElementById('startBurnBtn'),

    // Capacity
    capacityModeTitle: document.getElementById('capacityModeTitle'),
    capacityNumbers: document.getElementById('capacityNumbers'),
    capacityTrackCount: document.getElementById('capacityTrackCount'),
    capacityMediaInfo: document.getElementById('capacityMediaInfo'),
    capacityBarFill: document.getElementById('capacityBarFill'),

    // Table
    countAll: document.getElementById('countAll'),
    countSelected: document.getElementById('countSelected'),
    countUnselected: document.getElementById('countUnselected'),
    headerCheckbox: document.getElementById('headerCheckbox'),
    songTable: document.getElementById('songTable'),
    songTableBody: document.getElementById('songTableBody'),
    clearLibraryBtn: document.getElementById('clearLibraryBtn'),

    // Player
    playerAlbumArt: document.getElementById('playerAlbumArt'),
    playerTitle: document.getElementById('playerTitle'),
    playerArtist: document.getElementById('playerArtist'),
    playerHealthBadge: document.getElementById('playerHealthBadge'),
    playerBitrateText: document.getElementById('playerBitrateText'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    prevTrackBtn: document.getElementById('prevTrackBtn'),
    nextTrackBtn: document.getElementById('nextTrackBtn'),
    cueIntroBtn: document.getElementById('cueIntroBtn'),
    cueMiddleBtn: document.getElementById('cueMiddleBtn'),
    currentTimeLabel: document.getElementById('currentTimeLabel'),
    totalDurationLabel: document.getElementById('totalDurationLabel'),
    scrubBarTrack: document.getElementById('scrubBarTrack'),
    scrubBarFill: document.getElementById('scrubBarFill'),
    scrubBarHandle: document.getElementById('scrubBarHandle'),
    muteBtn: document.getElementById('muteBtn'),
    volumeSlider: document.getElementById('volumeSlider'),

    // Burn Modal
    burnModal: document.getElementById('burnModal'),
    burnModalTitle: document.getElementById('burnModalTitle'),
    burnModalSubtitle: document.getElementById('burnModalSubtitle'),
    burnStageLabel: document.getElementById('burnStageLabel'),
    burnDetailLabel: document.getElementById('burnDetailLabel'),
    burnMainProgressBar: document.getElementById('burnMainProgressBar'),
    burnPctText: document.getElementById('burnPctText'),
    burnLogs: document.getElementById('burnLogs'),
    closeBurnModalBtn: document.getElementById('closeBurnModalBtn'),

    // Erase Modal
    eraseModal: document.getElementById('eraseModal'),
    closeEraseModalX: document.getElementById('closeEraseModalX'),
    cancelEraseBtn: document.getElementById('cancelEraseBtn'),
    confirmEraseBtn: document.getElementById('confirmEraseBtn'),
    eraseStatusMsg: document.getElementById('eraseStatusMsg')
};

// INITIALIZATION
async function initApp() {
    setupEventListeners();
    setupAudioPlayerCallbacks();
    await loadDrives();
}

// SETUP LISTENERS
function setupEventListeners() {
    // Mode Switch
    dom.modeAudioBtn.addEventListener('click', () => setBurnMode('audio'));
    dom.modeDataBtn.addEventListener('click', () => setBurnMode('data'));

    // Drive Refresh
    dom.refreshDrivesBtn.addEventListener('click', loadDrives);
    dom.opticalDriveSelect.addEventListener('change', (e) => {
        state.selectedRecorderIndex = parseInt(e.target.value, 10) || 0;
        updateCapacityDisplay();
    });
    dom.gapControlSelect.addEventListener('change', updateCapacityDisplay);

    // Scanner
    dom.scanMusicFolderBtn.addEventListener('click', () => scanCommonFolder('Music'));
    dom.scanDownloadsFolderBtn.addEventListener('click', () => scanCommonFolder('Downloads'));
    dom.scanCustomFolderBtn.addEventListener('click', selectAndScanCustomFolder);
    dom.cancelScanBtn.addEventListener('click', cancelScan);

    // Search & Toolbar
    dom.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        dom.clearSearchBtn.classList.toggle('hidden', state.searchQuery === '');
        renderSongTable();
    });

    dom.clearSearchBtn.addEventListener('click', () => {
        dom.searchInput.value = '';
        state.searchQuery = '';
        dom.clearSearchBtn.classList.add('hidden');
        renderSongTable();
    });

    dom.selectAllBtn.addEventListener('click', selectAllVisible);
    dom.deselectAllBtn.addEventListener('click', deselectAll);
    dom.autoFitBtn.addEventListener('click', runAutoFit);
    dom.clearLibraryBtn.addEventListener('click', clearLibrary);

    // Filter pills
    document.querySelectorAll('.filter-pills .pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            state.currentFilter = e.target.getAttribute('data-filter');
            renderSongTable();
        });
    });

    // Table Header checkbox
    dom.headerCheckbox.addEventListener('change', (e) => {
        const visibleSongs = getFilteredSongs();
        visibleSongs.forEach(song => {
            if (e.target.checked) {
                state.selectedSongIds.add(song.id);
                if (!state.audioTrackOrder.includes(song.id)) {
                    state.audioTrackOrder.push(song.id);
                }
            } else {
                state.selectedSongIds.delete(song.id);
                state.audioTrackOrder = state.audioTrackOrder.filter(id => id !== song.id);
            }
        });
        renderSongTable();
        updateCounts();
        updateCapacityDisplay();
    });

    // Sorting headers
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (state.activeSort.column === col) {
                state.activeSort.ascending = !state.activeSort.ascending;
            } else {
                state.activeSort.column = col;
                state.activeSort.ascending = true;
            }
            renderSongTable();
        });
    });

    // Player Buttons
    dom.playPauseBtn.addEventListener('click', () => window.audioPlayer.togglePlay());
    dom.stopBtn.addEventListener('click', () => window.audioPlayer.stop());
    dom.prevTrackBtn.addEventListener('click', playPreviousTrack);
    dom.nextTrackBtn.addEventListener('click', playNextTrack);
    dom.cueIntroBtn.addEventListener('click', () => window.audioPlayer.jumpIntro(15));
    dom.cueMiddleBtn.addEventListener('click', () => window.audioPlayer.jumpMidpoint());

    // Scrub Bar Click
    dom.scrubBarTrack.addEventListener('click', (e) => {
        const rect = dom.scrubBarTrack.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        window.audioPlayer.seekRatio(ratio);
    });

    // Volume
    dom.volumeSlider.addEventListener('input', (e) => {
        window.audioPlayer.setVolume(parseFloat(e.target.value));
    });

    let isMuted = false;
    dom.muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        window.audioPlayer.setMuted(isMuted);
        dom.muteBtn.innerHTML = isMuted 
            ? '<i class="fa-solid fa-volume-xmark text-danger"></i>' 
            : '<i class="fa-solid fa-volume-high"></i>';
    });

    // Jewel Case Cover Modal
    dom.openCoverModalBtn.addEventListener('click', () => {
        const selected = getSelectedTracksInOrder();
        if (selected.length === 0) {
            alert('Please check at least one song to generate a jewel case insert booklet.');
            return;
        }
        window.coverGenerator.show(
            dom.discTitleInput.value,
            dom.discArtistInput.value,
            selected,
            state.mode
        );
    });

    // Erase Modal
    dom.openEraseModalBtn.addEventListener('click', () => {
        dom.eraseStatusMsg.classList.add('hidden');
        dom.eraseModal.classList.remove('hidden');
    });
    dom.closeEraseModalX.addEventListener('click', () => dom.eraseModal.classList.add('hidden'));
    dom.cancelEraseBtn.addEventListener('click', () => dom.eraseModal.classList.add('hidden'));
    dom.confirmEraseBtn.addEventListener('click', startEraseDisc);

    // Burning & ISO
    dom.startBurnBtn.addEventListener('click', startBurning);
    dom.saveIsoBtn.addEventListener('click', saveIsoImage);
    dom.closeBurnModalBtn.addEventListener('click', () => dom.burnModal.classList.add('hidden'));

    // IPC Subscriptions
    window.api.onScanProgress(updateScanProgress);
    window.api.onScanBatch(appendSongBatch);
    window.api.onBurnProgress(updateBurnProgress);
    window.api.onEraseProgress(updateEraseProgress);
}

// SETUP AUDIO PLAYER CALLBACKS
function setupAudioPlayerCallbacks() {
    window.audioPlayer.onTrackChange = (track) => {
        dom.playerTitle.textContent = track.title;
        dom.playerArtist.textContent = `${track.artist} • ${track.album}`;
        dom.playerBitrateText.textContent = track.bitrate;
        
        if (track.coverArt) {
            dom.playerAlbumArt.innerHTML = `<img src="${track.coverArt}" alt="Cover">`;
        } else {
            dom.playerAlbumArt.innerHTML = `<i class="fa-solid fa-music"></i>`;
        }

        // Highlight playing row
        document.querySelectorAll('.song-table tbody tr').forEach(row => {
            row.classList.toggle('row-playing', row.getAttribute('data-id') === track.id);
        });
    };

    window.audioPlayer.onPlaybackStateChange = (isPlaying) => {
        dom.playPauseBtn.innerHTML = isPlaying 
            ? '<i class="fa-solid fa-pause"></i>' 
            : '<i class="fa-solid fa-play"></i>';
    };

    window.audioPlayer.onTimeUpdate = (currentTime, duration) => {
        dom.currentTimeLabel.textContent = formatDuration(currentTime);
        dom.totalDurationLabel.textContent = formatDuration(duration);
        
        const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
        dom.scrubBarFill.style.width = `${pct}%`;
        dom.scrubBarHandle.style.left = `${pct}%`;
    };
}

// MODE SWITCHING
function setBurnMode(mode) {
    state.mode = mode;
    if (mode === 'audio') {
        dom.modeAudioBtn.classList.add('active');
        dom.modeDataBtn.classList.remove('active');
        document.querySelectorAll('.audio-only-setting, .audio-only-col').forEach(el => el.classList.remove('hidden'));
    } else {
        dom.modeDataBtn.classList.add('active');
        dom.modeAudioBtn.classList.remove('active');
        document.querySelectorAll('.audio-only-setting, .audio-only-col').forEach(el => el.classList.add('hidden'));
    }
    updateCapacityDisplay();
    renderSongTable();
}

// DRIVES LOADING
async function loadDrives() {
    dom.storageDrivesList.innerHTML = '<div class="loading-placeholder">Querying Windows drives...</div>';
    dom.opticalDriveSelect.innerHTML = '<option>Detecting optical drives...</option>';

    try {
        const drivesData = await window.api.getDrives();
        state.storageDrives = drivesData.StorageDrives || [];
        state.opticalDrives = drivesData.OpticalDrives || [];

        // Render Storage Drives
        dom.storageDrivesList.innerHTML = '';
        state.storageDrives.forEach(drive => {
            const totalGb = (drive.TotalSize / (1024 ** 3)).toFixed(0);
            const freeGb = (drive.FreeSpace / (1024 ** 3)).toFixed(0);

            const btn = document.createElement('button');
            btn.className = 'drive-card-btn';
            btn.innerHTML = `
                <div class="drive-card-left">
                    <i class="fa-solid fa-hard-drive drive-card-icon"></i>
                    <div>
                        <div class="drive-card-label">${drive.DeviceID} (${drive.VolumeName})</div>
                        <div class="drive-card-sub">${freeGb} GB free of ${totalGb} GB</div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-muted"></i>
            `;
            btn.addEventListener('click', () => startScanPath(`${drive.DeviceID}\\`));
            dom.storageDrivesList.appendChild(btn);
        });

        // Render Optical Drives
        dom.opticalDriveSelect.innerHTML = '';
        if (state.opticalDrives.length === 0) {
            dom.opticalDriveSelect.innerHTML = '<option value="0">No optical drive detected</option>';
        } else {
            state.opticalDrives.forEach(rec => {
                const opt = document.createElement('option');
                opt.value = rec.Index;
                const statusTag = rec.IsBlank ? '[Blank Disc Ready]' : (rec.MediaType !== 'No Disc Inserted' ? `[${rec.MediaType}]` : '[Tray Empty]');
                opt.textContent = `${rec.Vendor} ${rec.Product} (${rec.DriveLetter}) ${statusTag}`;
                dom.opticalDriveSelect.appendChild(opt);
            });
        }

        updateCapacityDisplay();
    } catch (err) {
        dom.storageDrivesList.innerHTML = `<div class="text-danger">Failed to query drives: ${err.message}</div>`;
    }
}

// SCANNING
async function startScanPath(dirPath) {
    if (state.isScanning) {
        alert('A scan is already in progress. Please wait or cancel the current scan.');
        return;
    }

    state.isScanning = true;
    dom.scanStatusText.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-cyan"></i> Scanning...';
    dom.cancelScanBtn.classList.remove('hidden');
    dom.scanProgressContainer.classList.remove('hidden');
    dom.scanDetails.textContent = `Scanning: ${dirPath}`;

    const res = await window.api.startScan(dirPath);
    state.isScanning = false;
    dom.cancelScanBtn.classList.add('hidden');
    dom.scanProgressContainer.classList.add('hidden');

    if (res && res.canceled) {
        dom.scanStatusText.innerHTML = '<i class="fa-solid fa-ban text-warning"></i> Scan Cancelled';
        dom.scanDetails.textContent = `Scan stopped. Found ${state.songs.length} songs so far.`;
    } else if (res && res.success) {
        dom.scanStatusText.innerHTML = '<i class="fa-solid fa-circle-check text-success"></i> Scan Complete';
        dom.scanDetails.textContent = `Found ${state.songs.length} total songs in library.`;
    } else {
        dom.scanStatusText.innerHTML = '<i class="fa-solid fa-circle-exclamation text-danger"></i> Scan Error';
        dom.scanDetails.textContent = (res && res.error) || 'Scan stopped.';
    }
    updateCounts();
}

async function scanCommonFolder(folderName) {
    const target = await window.api.getUserFolder(folderName === 'Music' ? 'music' : 'downloads');
    if (target) startScanPath(target);
}

async function selectAndScanCustomFolder() {
    const folder = await window.api.selectFolder();
    if (folder) {
        startScanPath(folder);
    }
}

async function cancelScan() {
    await window.api.cancelScan();
    dom.scanStatusText.innerHTML = '<i class="fa-solid fa-ban text-warning"></i> Scan Cancelled';
    dom.cancelScanBtn.classList.add('hidden');
    dom.scanProgressContainer.classList.add('hidden');
    state.isScanning = false;
}

function updateScanProgress(prog) {
    dom.scanDetails.textContent = `Scanning (${prog.scannedFiles} files checked, ${state.songs.length} audio found)...`;
}

function appendSongBatch(batch) {
    const existingIds = new Set(state.songs.map(s => s.id));
    for (const song of batch) {
        if (!existingIds.has(song.id)) {
            state.songs.push(song);
            existingIds.add(song.id);
        }
    }
    updateCounts();
    renderSongTable();
}

function clearLibrary() {
    if (state.songs.length === 0) return;
    if (confirm('Clear all songs from the current library?')) {
        state.songs = [];
        state.selectedSongIds.clear();
        state.audioTrackOrder = [];
        updateCounts();
        renderSongTable();
        updateCapacityDisplay();
    }
}

// SELECTION & TRACK SEQUENCING
function getSelectedTracksInOrder() {
    const selectedMap = new Map(state.songs.filter(s => state.selectedSongIds.has(s.id)).map(s => [s.id, s]));
    const ordered = [];
    
    // Add in explicit order
    for (const id of state.audioTrackOrder) {
        if (selectedMap.has(id)) {
            ordered.push(selectedMap.get(id));
            selectedMap.delete(id);
        }
    }
    // Add any remaining
    for (const [id, song] of selectedMap.entries()) {
        ordered.push(song);
    }
    return ordered;
}

function toggleSongSelection(songId, checked) {
    if (checked) {
        state.selectedSongIds.add(songId);
        if (!state.audioTrackOrder.includes(songId)) {
            state.audioTrackOrder.push(songId);
        }
    } else {
        state.selectedSongIds.delete(songId);
        state.audioTrackOrder = state.audioTrackOrder.filter(id => id !== songId);
    }
    updateCounts();
    updateCapacityDisplay();
}

function moveTrackOrder(songId, direction) {
    const index = state.audioTrackOrder.indexOf(songId);
    if (index === -1) return;
    
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= state.audioTrackOrder.length) return;

    // Swap
    const temp = state.audioTrackOrder[index];
    state.audioTrackOrder[index] = state.audioTrackOrder[targetIndex];
    state.audioTrackOrder[targetIndex] = temp;

    renderSongTable();
}

function selectAllVisible() {
    const visible = getFilteredSongs();
    visible.forEach(s => {
        state.selectedSongIds.add(s.id);
        if (!state.audioTrackOrder.includes(s.id)) {
            state.audioTrackOrder.push(s.id);
        }
    });
    renderSongTable();
    updateCounts();
    updateCapacityDisplay();
}

function deselectAll() {
    state.selectedSongIds.clear();
    state.audioTrackOrder = [];
    renderSongTable();
    updateCounts();
    updateCapacityDisplay();
}

// SMART AUTO-FIT ALGORITHM
async function runAutoFit() {
    if (state.songs.length === 0) {
        alert('Please scan drives or folders first to find songs.');
        return;
    }

    if (state.mode === 'audio') {
        const maxSeconds = 79.5 * 60; // leave a little headroom on an 80 min CD-R
        const fitted = await window.api.autoFitTracks({
            candidateTracks: getFilteredSongs(),
            maxSeconds,
            perTrackOverhead: 2 + (parseInt(dom.gapControlSelect.value, 10) || 0)
        });

        state.selectedSongIds.clear();
        state.audioTrackOrder = [];
        fitted.forEach(s => {
            state.selectedSongIds.add(s.id);
            state.audioTrackOrder.push(s.id);
        });
    } else {
        // Data CD 700MB (approx 690 MB safe)
        const maxBytes = 690 * 1024 * 1024;
        let total = 0;
        state.selectedSongIds.clear();
        state.audioTrackOrder = [];

        for (const song of getFilteredSongs()) {
            if (total + (song.sizeBytes || 0) <= maxBytes) {
                state.selectedSongIds.add(song.id);
                state.audioTrackOrder.push(song.id);
                total += song.sizeBytes;
            }
        }
    }

    renderSongTable();
    updateCounts();
    updateCapacityDisplay();
}

// FILTERING & SORTING
function getFilteredSongs() {
    let list = [...state.songs];

    // Filter pill
    if (state.currentFilter === 'selected') {
        list = list.filter(s => state.selectedSongIds.has(s.id));
    } else if (state.currentFilter === 'unselected') {
        list = list.filter(s => !state.selectedSongIds.has(s.id));
    }

    // Search query
    if (state.searchQuery) {
        const q = state.searchQuery;
        list = list.filter(s => 
            (s.title && s.title.toLowerCase().includes(q)) ||
            (s.artist && s.artist.toLowerCase().includes(q)) ||
            (s.album && s.album.toLowerCase().includes(q)) ||
            (s.genre && s.genre.toLowerCase().includes(q)) ||
            (s.filePath && s.filePath.toLowerCase().includes(q))
        );
    }

    // Sorting
    if (state.activeSort.column) {
        const col = state.activeSort.column;
        const asc = state.activeSort.ascending ? 1 : -1;

        list.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];
            if (typeof valA === 'string') return valA.localeCompare(valB) * asc;
            return ((valA || 0) - (valB || 0)) * asc;
        });
    }

    return list;
}

// RENDER SONG TABLE
function renderSongTable() {
    const visibleSongs = getFilteredSongs();
    dom.songTableBody.innerHTML = '';

    // Update master header checkbox state
    if (visibleSongs.length > 0) {
        const allSelected = visibleSongs.every(s => state.selectedSongIds.has(s.id));
        const someSelected = visibleSongs.some(s => state.selectedSongIds.has(s.id));
        dom.headerCheckbox.checked = allSelected;
        dom.headerCheckbox.indeterminate = !allSelected && someSelected;
    } else {
        dom.headerCheckbox.checked = false;
        dom.headerCheckbox.indeterminate = false;
    }

    if (visibleSongs.length === 0) {
        dom.songTableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-icon"><i class="fa-solid fa-music"></i></div>
                        <h3>No matching songs found</h3>
                        <p>Try clearing your search query or scan more folders.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    visibleSongs.forEach(song => {
        const isSelected = state.selectedSongIds.has(song.id);
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', song.id);
        if (window.audioPlayer.currentTrack && window.audioPlayer.currentTrack.id === song.id) {
            tr.classList.add('row-playing');
        }

        const isAudioMode = state.mode === 'audio';
        const orderIdx = state.audioTrackOrder.indexOf(song.id);
        const orderDisplay = isSelected && orderIdx !== -1 ? (orderIdx + 1) : '-';

        tr.innerHTML = `
            <td class="col-check">
                <input type="checkbox" class="song-checkbox" ${isSelected ? 'checked' : ''}>
            </td>
            <td class="col-play">
                <button class="play-row-btn" title="Play preview"><i class="fa-solid fa-play"></i></button>
            </td>
            <td class="col-order audio-only-col ${!isAudioMode ? 'hidden' : ''}">
                <div class="order-controls">
                    <span>${orderDisplay}</span>
                    ${isSelected ? `
                        <button class="order-btn btn-order-up" title="Move track up"><i class="fa-solid fa-chevron-up"></i></button>
                        <button class="order-btn btn-order-down" title="Move track down"><i class="fa-solid fa-chevron-down"></i></button>
                    ` : ''}
                </div>
            </td>
            <td class="col-title" title="${escapeHtml(song.filePath)}">${escapeHtml(song.title)}</td>
            <td class="col-artist">${escapeHtml(song.artist)}</td>
            <td class="col-album">${escapeHtml(song.album)}</td>
            <td class="col-duration">${song.durationStr}</td>
            <td class="col-bitrate">
                <span class="bitrate-tag ${song.bitrateNum >= 256 ? 'high' : ''}">${song.bitrate}</span>
            </td>
            <td class="col-size">${song.sizeStr}</td>
        `;

        // Checkbox event
        const cb = tr.querySelector('.song-checkbox');
        cb.addEventListener('change', (e) => {
            toggleSongSelection(song.id, e.target.checked);
            renderSongTable();
        });

        // Play event
        const playBtn = tr.querySelector('.play-row-btn');
        playBtn.addEventListener('click', () => {
            window.audioPlayer.loadTrack(song, true);
        });

        // Reorder buttons
        if (isSelected && isAudioMode) {
            const upBtn = tr.querySelector('.btn-order-up');
            const downBtn = tr.querySelector('.btn-order-down');
            if (upBtn) upBtn.addEventListener('click', () => moveTrackOrder(song.id, -1));
            if (downBtn) downBtn.addEventListener('click', () => moveTrackOrder(song.id, 1));
        }

        dom.songTableBody.appendChild(tr);
    });
}

// CAPACITY BAR UPDATE
function updateCapacityDisplay() {
    const selected = getSelectedTracksInOrder();
    const count = selected.length;
    dom.capacityTrackCount.textContent = `(${count} track${count === 1 ? '' : 's'} selected)`;

    if (state.mode === 'audio') {
        dom.capacityModeTitle.textContent = 'Audio CD Capacity:';
        
        const totalSeconds = audioSecondsFor(selected);

        const maxSeconds = 80 * 60; // 80 min CD
        const pct = (totalSeconds / maxSeconds) * 100;
        
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        dom.capacityNumbers.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs} / 80:00 min`;

        dom.capacityBarFill.style.width = `${Math.min(100, pct)}%`;
        dom.capacityBarFill.classList.toggle('capacity-warning', pct > 90 && pct <= 100);
        dom.capacityBarFill.classList.toggle('capacity-overflow', pct > 100);

        dom.capacityMediaInfo.textContent = `Red Book Audio CD (${(pct).toFixed(1)}% full)`;
    } else {
        dom.capacityModeTitle.textContent = 'Data MP3 CD Capacity:';
        
        let totalBytes = 0;
        selected.forEach(t => {
            totalBytes += (t.sizeBytes || 0);
        });

        const maxBytes = 700 * 1024 * 1024; // 700MB CD-R
        const pct = (totalBytes / maxBytes) * 100;
        const usedMb = (totalBytes / (1024 * 1024)).toFixed(1);

        dom.capacityNumbers.textContent = `${usedMb} MB / 700.0 MB`;
        dom.capacityBarFill.style.width = `${Math.min(100, pct)}%`;
        dom.capacityBarFill.classList.toggle('capacity-warning', pct > 90 && pct <= 100);
        dom.capacityBarFill.classList.toggle('capacity-overflow', pct > 100);

        dom.capacityMediaInfo.textContent = `ISO9660 Data Disc (${(pct).toFixed(1)}% full)`;
    }
}

function updateCounts() {
    dom.countAll.textContent = state.songs.length;
    dom.countSelected.textContent = state.selectedSongIds.size;
    dom.countUnselected.textContent = state.songs.length - state.selectedSongIds.size;
}

// NEXT / PREVIOUS PLAYBACK
function playNextTrack() {
    const list = getFilteredSongs();
    if (list.length === 0) return;
    if (!window.audioPlayer.currentTrack) {
        window.audioPlayer.loadTrack(list[0], true);
        return;
    }
    const idx = list.findIndex(s => s.id === window.audioPlayer.currentTrack.id);
    if (idx !== -1 && idx + 1 < list.length) {
        window.audioPlayer.loadTrack(list[idx + 1], true);
    }
}

function playPreviousTrack() {
    const list = getFilteredSongs();
    if (list.length === 0) return;
    if (!window.audioPlayer.currentTrack) {
        window.audioPlayer.loadTrack(list[0], true);
        return;
    }
    const idx = list.findIndex(s => s.id === window.audioPlayer.currentTrack.id);
    if (idx > 0) {
        window.audioPlayer.loadTrack(list[idx - 1], true);
    }
}

// BURNING WORKFLOWS
function audioSecondsFor(tracks) {
    // Track-At-Once adds a 2 s gap before every track, plus any extra gap the user chose
    const perTrack = 2 + (parseInt(dom.gapControlSelect.value, 10) || 0);
    return tracks.reduce((acc, t) => acc + (t.duration || 0) + perTrack, 0);
}

async function startBurning() {
    const selectedTracks = getSelectedTracksInOrder();
    if (selectedTracks.length === 0) {
        alert('Please select at least one song to burn.');
        return;
    }

    const testRun = dom.testRunCheckbox.checked;
    const isAudio = state.mode === 'audio';

    if (isAudio) {
        if (selectedTracks.length > 99) {
            alert(`Audio CDs can hold at most 99 tracks. You have ${selectedTracks.length} selected.`);
            return;
        }
        const totalSecs = audioSecondsFor(selectedTracks);
        if (totalSecs > 80 * 60) {
            alert(`These songs add up to ${(totalSecs / 60).toFixed(1)} minutes, which won't fit on an 80-minute CD. Remove some songs or use Auto-Fit.`);
            return;
        }
    }

    const drive = state.opticalDrives.find(d => d.Index === state.selectedRecorderIndex) || state.opticalDrives[0];
    if (!drive) {
        alert('No CD/DVD burner detected. Click the refresh button next to the drive list.');
        return;
    }

    if (!testRun) {
        const what = isAudio ? `an audio CD with ${selectedTracks.length} songs` : `a data disc with ${selectedTracks.length} files`;
        if (!confirm(`This will burn ${what} to the disc in ${drive.DriveLetter}.\n\nA CD-R can only be burned once. Continue?`)) {
            return;
        }
    }

    const kind = isAudio ? 'Audio CD' : 'Data MP3 Disc';
    dom.burnModalTitle.textContent = testRun ? `Test Run: ${kind}` : `Burning ${kind}`;
    dom.burnModalSubtitle.textContent = testRun
        ? `Checking everything on ${drive.Vendor} ${drive.Product} (${drive.DriveLetter}) - nothing will be written`
        : `Writing to ${drive.Vendor} ${drive.Product} (${drive.DriveLetter})`;
    dom.burnStageLabel.textContent = 'Starting...';
    dom.burnDetailLabel.textContent = '';
    dom.burnMainProgressBar.style.width = '0%';
    dom.burnPctText.textContent = '0%';
    dom.burnLogs.innerHTML = '';
    dom.closeBurnModalBtn.classList.add('hidden');
    dom.burnModal.classList.remove('hidden');

    const common = {
        recorderIndex: drive.Index,
        ejectOnCompletion: dom.ejectCheckbox.checked,
        testRun,
        speed: parseInt(dom.speedSelect.value, 10) || 0
    };

    const result = isAudio
        ? await window.api.burnAudioDisc({
            ...common,
            tracks: selectedTracks,
            normalize: dom.normalizeAudioCheckbox.checked,
            extraGapSeconds: parseInt(dom.gapControlSelect.value, 10) || 0
        })
        : await window.api.burnDataDisc({
            ...common,
            volumeLabel: dom.discTitleInput.value,
            files: selectedTracks,
            preserveFolders: true
        });

    if (result && result.success) {
        dom.burnStageLabel.textContent = result.stage || (testRun ? 'Test run passed' : 'Burn complete');
        dom.burnDetailLabel.textContent = result.detail || '';
        dom.burnMainProgressBar.style.width = '100%';
        dom.burnPctText.textContent = '100%';
        appendBurnLog(`DONE: ${result.stage} ${result.detail || ''}`);
        if (!testRun) loadDrives();
    } else {
        const msg = (result && result.error) || 'Unknown error';
        dom.burnStageLabel.innerHTML = `<i class="fa-solid fa-circle-exclamation text-danger"></i> ${testRun ? 'Test run failed' : 'Burn failed'}`;
        dom.burnDetailLabel.textContent = msg;
        appendBurnLog(`ERROR: ${msg}`);
    }
    dom.closeBurnModalBtn.classList.remove('hidden');
}
async function saveIsoImage() {
    const selectedTracks = getSelectedTracksInOrder();
    if (selectedTracks.length === 0) {
        alert('Please check at least one song to save to ISO image.');
        return;
    }

    dom.burnModalTitle.textContent = 'Compiling ISO Disc Image';
    dom.burnModalSubtitle.textContent = 'Creating ISO9660/Joliet master file...';
    dom.burnStageLabel.textContent = 'Building file structure...';
    dom.burnDetailLabel.textContent = 'Adding tracks';
    dom.burnMainProgressBar.style.width = '0%';
    dom.burnPctText.textContent = '0%';
    dom.burnLogs.innerHTML = '';
    dom.closeBurnModalBtn.classList.add('hidden');
    dom.burnModal.classList.remove('hidden');

    const res = await window.api.saveIsoImage({
        volumeLabel: dom.discTitleInput.value || 'MP3_DISC',
        files: selectedTracks,
        preserveFolders: true
    });

    if (res && res.success) {
        dom.burnStageLabel.textContent = 'ISO Image Generated Successfully!';
        dom.burnDetailLabel.textContent = `Saved to: ${res.filePath}`;
        dom.burnMainProgressBar.style.width = '100%';
        dom.burnPctText.textContent = '100%';
        dom.closeBurnModalBtn.classList.remove('hidden');
    } else if (res && res.canceled) {
        dom.burnModal.classList.add('hidden');
    } else {
        dom.burnStageLabel.textContent = 'ISO Creation Failed';
        dom.burnDetailLabel.textContent = (res && res.error) || 'Unknown error';
        dom.closeBurnModalBtn.classList.remove('hidden');
    }
}

async function startEraseDisc() {
    const fullErase = document.querySelector('input[name="eraseMode"]:checked').value === 'full';
    dom.eraseStatusMsg.className = 'alert-box alert-info';
    dom.eraseStatusMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Erasing disc... Please wait.';
    dom.eraseStatusMsg.classList.remove('hidden');

    const res = await window.api.eraseDisc({
        recorderIndex: state.selectedRecorderIndex,
        fullErase
    });

    if (res.success) {
        dom.eraseStatusMsg.className = 'alert-box alert-success';
        dom.eraseStatusMsg.textContent = 'Disc erased successfully!';
        setTimeout(() => dom.eraseModal.classList.add('hidden'), 2000);
        await loadDrives();
    } else {
        dom.eraseStatusMsg.className = 'alert-box alert-danger';
        dom.eraseStatusMsg.textContent = res.error || 'Erase failed. Ensure a rewritable CD-RW is in the drive.';
    }
}

function updateBurnProgress(prog) {
    if (prog.stage) dom.burnStageLabel.textContent = prog.stage;
    if (prog.detail) dom.burnDetailLabel.textContent = prog.detail;
    if (prog.percent !== undefined) {
        dom.burnMainProgressBar.style.width = `${prog.percent}%`;
        dom.burnPctText.textContent = `${prog.percent}%`;
    }
    appendBurnLog(`[${prog.percent || 0}%] ${prog.stage || ''} ${prog.detail ? '- ' + prog.detail : ''}`);
}

function updateEraseProgress(prog) {
    if (prog.stage) {
        dom.eraseStatusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${prog.stage}`;
    }
}

function appendBurnLog(msg) {
    const line = document.createElement('div');
    line.textContent = msg;
    dom.burnLogs.appendChild(line);
    dom.burnLogs.scrollTop = dom.burnLogs.scrollHeight;
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Run App on Load
window.addEventListener('DOMContentLoaded', initApp);
