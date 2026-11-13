const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma']);

class ScannerService {
    constructor() {
        this.isScanning = false;
        this.shouldCancel = false;
        this.musicMetadata = null;
    }

    async init() {
        if (!this.musicMetadata) {
            this.musicMetadata = await import('music-metadata');
        }
    }

    cancelScan() {
        if (this.isScanning) {
            this.shouldCancel = true;
        }
    }

    formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    formatFileSize(bytes) {
        if (!bytes || isNaN(bytes)) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    }

    async readAudioMetadata(filePath) {
        await this.init();
        const stat = await fs.promises.stat(filePath);
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let title = path.basename(filePath, ext);
        let artist = 'Unknown Artist';
        let album = 'Unknown Album';
        let genre = 'Unknown';
        let year = '';
        let duration = 0;
        let bitrate = 0;
        let coverArt = null;

        try {
            const metadata = await this.musicMetadata.parseFile(filePath, { skipCovers: false });
            const common = metadata.common || {};
            const format = metadata.format || {};

            if (common.title && common.title.trim()) title = common.title.trim();
            if (common.artist && common.artist.trim()) artist = common.artist.trim();
            else if (common.albumartist && common.albumartist.trim()) artist = common.albumartist.trim();
            if (common.album && common.album.trim()) album = common.album.trim();
            if (common.genre && common.genre.length > 0) genre = common.genre.join(', ');
            if (common.year) year = common.year.toString();

            duration = format.duration || 0;
            bitrate = format.bitrate ? Math.round(format.bitrate / 1000) : 0;

            if (common.picture && common.picture.length > 0) {
                const pic = common.picture[0];
                const base64 = Buffer.from(pic.data).toString('base64');
                coverArt = `data:${pic.format};base64,${base64}`;
            }
        } catch (e) {
            // Fallback to filename parsing
            const match = title.match(/^(.+?)\s*-\s*(.+)$/);
            if (match) {
                artist = match[1].trim();
                title = match[2].trim();
            }
        }

        return {
            id: Buffer.from(filePath).toString('base64'),
            filePath,
            fileName,
            extension: ext,
            title,
            artist,
            album,
            genre,
            year,
            duration,
            durationStr: this.formatDuration(duration),
            bitrate: bitrate > 0 ? `${bitrate} kbps` : 'Unknown',
            bitrateNum: bitrate,
            sizeBytes: stat.size,
            sizeStr: this.formatFileSize(stat.size),
            coverArt
        };
    }

    async scanDirectory(targetPath, onProgress, onBatchFound) {
        await this.init();
        this.isScanning = true;
        this.shouldCancel = false;

        const results = [];
        let batch = [];
        let scannedDirs = 0;
        let scannedFiles = 0;

        const walk = async (dir) => {
            if (this.shouldCancel) return;

            scannedDirs++;
            if (scannedDirs % 20 === 0 && onProgress) {
                onProgress({ currentDir: dir, scannedDirs, scannedFiles, totalFound: results.length });
            }

            let entries = [];
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch (err) {
                return; // Skip folders without permission
            }

            for (const entry of entries) {
                if (this.shouldCancel) return;
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Skip system / temporary / recycling directories
                    const lower = entry.name.toLowerCase();
                    if (
                        lower.startsWith('$') ||
                        lower === 'system volume information' ||
                        lower === 'windows' ||
                        lower === 'node_modules' ||
                        lower === 'appdata'
                    ) {
                        continue;
                    }
                    await walk(fullPath);
                } else if (entry.isFile()) {
                    scannedFiles++;
                    const ext = path.extname(entry.name).toLowerCase();
                    if (SUPPORTED_EXTENSIONS.has(ext)) {
                        try {
                            const track = await this.readAudioMetadata(fullPath);
                            results.push(track);
                            batch.push(track);

                            if (batch.length >= 10) {
                                if (onBatchFound) onBatchFound(batch);
                                batch = [];
                            }
                        } catch (e) {
                            // ignore unreadable file
                        }
                    }
                }
            }
        };

        let wasCanceled = false;
        try {
            await walk(targetPath);
            if (batch.length > 0 && onBatchFound) {
                onBatchFound(batch);
            }
        } finally {
            wasCanceled = this.shouldCancel;
            this.isScanning = false;
        }

        results.canceled = wasCanceled;
        return results;
    }
}

module.exports = new ScannerService();
