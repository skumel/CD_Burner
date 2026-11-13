const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpegPath = require('ffmpeg-static');

const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const CD_SECTOR_BYTES = 2352;          // one audio CD sector (1/75 s of 44.1 kHz 16-bit stereo)
const MAX_NAME_CHARS = 64;             // Joliet limit, which most car stereos read

class BurnerService {
    constructor() {
        this.currentProcess = null;
        this.tempDir = path.join(os.tmpdir(), 'SonicBurn_Work');
        fs.mkdirSync(this.tempDir, { recursive: true });
    }

    safeRemoveDir(dirPath) {
        try {
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
            }
        } catch {
            // Best effort on Windows if background handles release slightly later
        }
    }

    // Runs a PowerShell script that prints one JSON event per line.
    // Resolves with the final 'completed' event, rejects with the script's error message.
    runScript(scriptName, args, onProgress) {
        const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(SCRIPTS_DIR, scriptName), ...args];

        return new Promise((resolve, reject) => {
            const child = spawn('powershell.exe', psArgs, { windowsHide: true });
            this.currentProcess = child;

            let buffer = '';
            let stderr = '';
            let completed = null;
            let errorMsg = null;

            const handleLine = (line) => {
                line = line.trim();
                if (!line.startsWith('{')) return;
                let evt;
                try { evt = JSON.parse(line); } catch { return; }
                if (evt.type === 'error') errorMsg = evt.message;
                else if (evt.type === 'completed') { completed = evt; if (onProgress) onProgress(evt); }
                else if (onProgress) onProgress(evt);
            };

            child.stdout.on('data', (data) => {
                buffer += data.toString('utf8');
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop();
                lines.forEach(handleLine);
            });
            child.stderr.on('data', (d) => { stderr += d.toString(); });

            child.on('close', (code) => {
                if (buffer) handleLine(buffer);
                this.currentProcess = null;
                if (errorMsg) return reject(new Error(errorMsg));
                if (code === 0 && completed) return resolve(completed);
                reject(new Error(stderr.trim() || `${scriptName} exited with code ${code}`));
            });
        });
    }

    async getDrives() {
        return new Promise((resolve, reject) => {
            const child = spawn('powershell.exe', [
                '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(SCRIPTS_DIR, 'get-drives.ps1')
            ], { windowsHide: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.stderr.on('data', (d) => { stderr += d.toString(); });
            child.on('close', (code) => {
                try {
                    const result = JSON.parse(stdout.trim());
                    // ConvertTo-Json emits a single object (not array) when there is only one item
                    const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
                    resolve({ StorageDrives: arr(result.StorageDrives), OpticalDrives: arr(result.OpticalDrives) });
                } catch (e) {
                    reject(new Error(stderr || `Drive detection failed (code ${code})`));
                }
            });
        });
    }

    // Converts any audio file to raw CD audio: 44.1 kHz, 16-bit, stereo, little-endian PCM,
    // padded with silence to a whole number of CD sectors.
    transcodeToCdPcm(sourcePath, destPath, { normalize = true, extraGapSeconds = 0 } = {}) {
        return new Promise((resolve, reject) => {
            const args = ['-hide_banner', '-nostdin', '-y', '-i', sourcePath, '-vn'];
            const filters = [];
            if (normalize) filters.push('loudnorm=I=-14:TP=-1.0:LRA=11');
            if (extraGapSeconds > 0) filters.push(`apad=pad_dur=${extraGapSeconds}`);
            if (filters.length) args.push('-af', filters.join(','));
            args.push('-ar', '44100', '-ac', '2', '-f', 's16le', '-acodec', 'pcm_s16le', destPath);

            const proc = spawn(ffmpegPath, args, { windowsHide: true });
            let stderr = '';
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('close', (code) => {
                if (code !== 0 || !fs.existsSync(destPath)) {
                    return reject(new Error(`Could not convert "${path.basename(sourcePath)}": ${stderr.slice(-300)}`));
                }
                const size = fs.statSync(destPath).size;
                const remainder = size % CD_SECTOR_BYTES;
                if (remainder) fs.appendFileSync(destPath, Buffer.alloc(CD_SECTOR_BYTES - remainder));
                resolve(fs.statSync(destPath).size);
            });
        });
    }

    async burnAudioDisc(config, onProgress) {
        const {
            recorderIndex = 0,
            tracks = [],
            normalize = true,
            extraGapSeconds = 0,
            ejectOnCompletion = true,
            testRun = false,
            speed = 0
        } = config;

        const workDir = path.join(this.tempDir, `audio_${Date.now()}`);
        fs.mkdirSync(workDir, { recursive: true });

        try {
            const prepared = [];
            for (let i = 0; i < tracks.length; i++) {
                const t = tracks[i];
                onProgress && onProgress({
                    status: 'transcoding',
                    percent: Math.round((i / tracks.length) * 30),
                    stage: `Converting track ${i + 1} of ${tracks.length} to CD audio`,
                    detail: `${t.artist} - ${t.title}`,
                    testRun
                });
                const pcmPath = path.join(workDir, `track_${String(i + 1).padStart(2, '0')}.pcm`);
                await this.transcodeToCdPcm(t.filePath, pcmPath, { normalize, extraGapSeconds });
                prepared.push({ title: t.title, artist: t.artist, pcmPath });
            }

            const manifestPath = path.join(workDir, 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify({ tracks: prepared }), 'utf8');

            const args = ['-RecorderIndex', String(recorderIndex), '-ManifestPath', manifestPath, '-Speed', String(speed)];
            if (testRun) args.push('-TestRun');
            if (ejectOnCompletion && !testRun) args.push('-EjectOnCompletion');

            const done = await this.runScript('burn-audio.ps1', args, onProgress);
            return { success: true, testRun, stage: done.stage, detail: done.detail };
        } finally {
            this.safeRemoveDir(workDir);
        }
    }

    // Builds unique, length-limited disc paths (Artist\Album\file.mp3 or flat).
    buildDiscPaths(files, preserveFolders) {
        const clean = (s, max) => {
            let out = (s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim();
            return (out || '_').substring(0, max).trim();
        };
        const used = new Set();
        return files.map((f) => {
            const ext = path.extname(f.fileName);
            const base = clean(path.basename(f.fileName, ext), MAX_NAME_CHARS - ext.length - 4);
            const dir = preserveFolders
                ? `${clean(f.artist || 'Unknown Artist', MAX_NAME_CHARS)}\\${clean(f.album || 'Unknown Album', MAX_NAME_CHARS)}\\`
                : '';
            let candidate = `${dir}${base}${ext}`;
            let n = 2;
            while (used.has(candidate.toLowerCase())) {
                candidate = `${dir}${base} (${n++})${ext}`;
            }
            used.add(candidate.toLowerCase());
            return { sourcePath: f.filePath, discRelativePath: candidate };
        });
    }

    cleanVolumeLabel(label) {
        return (label || 'MP3_DISC').replace(/[^a-zA-Z0-9 _-]/g, '_').substring(0, 32).trim() || 'MP3_DISC';
    }

    async burnDataDisc(config, onProgress) {
        const {
            recorderIndex = 0,
            volumeLabel = 'MP3_DISC',
            files = [],
            preserveFolders = true,
            ejectOnCompletion = true,
            testRun = false,
            speed = 0
        } = config;

        const workDir = path.join(this.tempDir, `data_${Date.now()}`);
        fs.mkdirSync(workDir, { recursive: true });
        try {
            const manifestPath = path.join(workDir, 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify({ files: this.buildDiscPaths(files, preserveFolders) }), 'utf8');

            const args = [
                '-RecorderIndex', String(recorderIndex),
                '-VolumeLabel', this.cleanVolumeLabel(volumeLabel),
                '-ManifestPath', manifestPath,
                '-Speed', String(speed)
            ];
            if (testRun) args.push('-TestRun');
            if (ejectOnCompletion && !testRun) args.push('-EjectOnCompletion');

            const done = await this.runScript('burn-data.ps1', args, onProgress);
            return { success: true, testRun, stage: done.stage, detail: done.detail };
        } finally {
            this.safeRemoveDir(workDir);
        }
    }

    async eraseDisc(recorderIndex = 0, fullErase = false, onProgress) {
        const args = ['-RecorderIndex', String(recorderIndex)];
        if (fullErase) args.push('-FullErase');
        const done = await this.runScript('erase-disc.ps1', args, onProgress);
        return { success: true, stage: done.stage, detail: done.detail };
    }

    async createIsoImage(config, outputPath, onProgress) {
        const { volumeLabel = 'MP3_DISC', files = [], preserveFolders = true } = config;
        const workDir = path.join(this.tempDir, `iso_${Date.now()}`);
        fs.mkdirSync(workDir, { recursive: true });
        try {
            const manifestPath = path.join(workDir, 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify({ files: this.buildDiscPaths(files, preserveFolders) }), 'utf8');
            const done = await this.runScript('make-iso.ps1', [
                '-ManifestPath', manifestPath,
                '-OutputPath', outputPath,
                '-VolumeLabel', this.cleanVolumeLabel(volumeLabel)
            ], onProgress);
            return { success: true, stage: done.stage, detail: done.detail };
        } finally {
            this.safeRemoveDir(workDir);
        }
    }

    // Greedy fill: longest songs first, stop adding when the next one would overflow.
    autoFitTracks(candidateTracks, maxSeconds = 80 * 60, perTrackOverhead = 2) {
        const sorted = [...candidateTracks].sort((a, b) => (b.duration || 0) - (a.duration || 0));
        let total = 0;
        const selected = [];
        for (const t of sorted) {
            const d = (t.duration || 0) + perTrackOverhead;
            if (selected.length < 99 && total + d <= maxSeconds) {
                selected.push(t);
                total += d;
            }
        }
        return selected;
    }
}

module.exports = new BurnerService();
