class CoverGenerator {
    constructor() {
        this.modal = document.getElementById('coverModal');
        this.discTitleEl = document.getElementById('coverDiscTitle');
        this.discArtistEl = document.getElementById('coverDiscArtist');
        this.metaInfoEl = document.getElementById('coverMetaInfo');
        this.tracklistEl = document.getElementById('coverTracklistContainer');
        this.totalTimeEl = document.getElementById('coverTotalTime');
        this.coverArtBox = document.getElementById('coverArtBox');
        this.closeBtn = document.getElementById('closeCoverModalBtn');
        this.closeX = document.getElementById('closeCoverModalX');
        this.printBtn = document.getElementById('printCoverBtn');

        this.setupEvents();
    }

    setupEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.hide());
        if (this.closeX) this.closeX.addEventListener('click', () => this.hide());
        if (this.printBtn) this.printBtn.addEventListener('click', () => this.print());
    }

    show(discTitle, discArtist, selectedTracks, mode = 'audio') {
        this.discTitleEl.textContent = discTitle || 'My Sonic Mix';
        this.discArtistEl.textContent = discArtist || 'Various Artists';
        
        let totalSeconds = 0;
        let totalBytes = 0;
        let firstCover = null;

        this.tracklistEl.innerHTML = '';

        selectedTracks.forEach((track, idx) => {
            totalSeconds += (track.duration || 0);
            totalBytes += (track.sizeBytes || 0);
            if (!firstCover && track.coverArt) {
                firstCover = track.coverArt;
            }

            const row = document.createElement('div');
            row.className = 'cover-track-item';
            row.innerHTML = `
                <span><strong>${idx + 1}.</strong> ${escapeHtml(track.artist)} - ${escapeHtml(track.title)}</span>
                <span>${track.durationStr || '0:00'}</span>
            `;
            this.tracklistEl.appendChild(row);
        });

        if (firstCover) {
            this.coverArtBox.innerHTML = `<img src="${firstCover}" alt="Cover Art">`;
        } else {
            this.coverArtBox.innerHTML = `<i class="fa-solid fa-compact-disc"></i>`;
        }

        const totalMins = Math.floor(totalSeconds / 60);
        const totalSecs = Math.floor(totalSeconds % 60);
        const totalDurationStr = `${totalMins}:${totalSecs < 10 ? '0' : ''}${totalSecs}`;
        
        this.totalTimeEl.textContent = mode === 'audio' 
            ? `${totalDurationStr} (${selectedTracks.length} tracks)`
            : `${(totalBytes / (1024*1024)).toFixed(1)} MB (${selectedTracks.length} files)`;

        const year = new Date().getFullYear();
        this.metaInfoEl.textContent = mode === 'audio' 
            ? `Standard Audio CD DA • Red Book • ${year}`
            : `Data MP3 Disc • ISO9660 • ${year}`;

        this.modal.classList.remove('hidden');
    }

    hide() {
        this.modal.classList.add('hidden');
    }

    print() {
        const printableArea = document.getElementById('printableCoverArea');
        if (!printableArea) return;

        let iframe = document.getElementById('coverPrintIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'coverPrintIframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }

        const printDoc = iframe.contentWindow.document;
        printDoc.open();
        printDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print CD Jewel Case Booklet</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        background: white;
                        color: black;
                        margin: 0;
                    }
                    .jewel-case-insert {
                        width: 4.75in;
                        min-height: 4.75in;
                        border: 1px dashed #666;
                        padding: 16px;
                        margin: 0 auto;
                        box-sizing: border-box;
                    }
                    .insert-header { display: flex; gap: 12px; align-items: center; }
                    .cover-album-art { width: 50px; height: 50px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                    .cover-album-art img { width: 100%; height: 100%; object-fit: cover; }
                    .cover-album-art svg, .cover-album-art i { font-size: 24px; color: #666; }
                    .cover-title-block h2 { font-size: 16px; margin: 0 0 2px 0; color: #111; }
                    .cover-title-block h3 { font-size: 12px; margin: 0; color: #555; }
                    .cover-meta-info { font-size: 9px; color: #777; margin-top: 2px; }
                    .cover-divider { margin: 8px 0; border: none; border-top: 1px solid #ccc; }
                    .cover-tracklist { font-size: 10px; display: flex; flex-direction: column; gap: 2px; }
                    .cover-track-item { display: flex; justify-content: space-between; border-bottom: 1px dotted #ddd; padding: 1px 0; }
                    .cover-footer { display: flex; justify-content: space-between; font-size: 9px; color: #777; margin-top: 10px; border-top: 1px solid #eee; padding-top: 4px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 10px; font-size: 11px; color: #888;">
                    Cut along dashed lines to fit standard CD Jewel Case (120mm x 120mm)
                </div>
                ${printableArea.innerHTML}
            </body>
            </html>
        `);
        printDoc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
        }, 250);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.coverGenerator = new CoverGenerator();
