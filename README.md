# 💿 SonicBurn - Windows CD Burner & Audio Studio

A modern Windows CD burning application with intelligent drive scanning, ID3 metadata extraction, live audio preview testing, and physical disc burning.

---

## 🌟 Key Features

- 🔍 **Drive & Folder Scanner**: One-click scan across internal/external drives (`C:\`, `E:\`, USBs) or custom folders (`Music`, `Downloads`, etc.) with recursive MP3, WAV, FLAC, M4A/AAC, OGG, and WMA discovery.
- 🎵 **Dual Burn Modes**:
  - **Audio CD (Standard CD-DA / Red Book)**: Transcodes audio tracks to 44.1 kHz 16-bit stereo PCM with CD-Text, track gap controls, volume normalization, and 80-minute capacity meter.
  - **Data MP3 CD**: Burns files and folders directly with ISO9660/Joliet/UDF filesystem, custom disc label, and 700 MB capacity meter.
- 🎧 **Audio Player & Fast Cue Testing**:
  - Integrated preview player with scrub bar, volume, mute, and track health inspector.
  - **+15s Intro Jump** and **50% Midpoint Cue** buttons for instant track verification.
- 🪄 **Smart Auto-Fit Algorithm**: One-click knapsack optimizer that selects the best combination of songs to fill the disc to capacity without overflowing.
- 📑 **Track Sequencing**: Move Up/Down buttons to customize track order before burning.
- 📄 **Jewel Case Booklet & Inlay Generator**: Generates and prints CD jewel case tracklist inserts with album art, durations, and cut lines.
- 📀 **Optical Drive Management**: Direct integration with Windows IMAPI2 to detect drives (e.g., `MATSHITA DVD+-RW UJ8E0`), disc blank status, and burn speeds.
- 🧽 **CD-RW / DVD-RW Disc Erasing**: Quick and full erase modes for rewritable media.
- 💾 **Save as ISO**: Export compilations directly as `.iso` disc images on disk.

---

## 🚀 How to Launch

1. Double-click `run-app.bat` or run:
   ```cmd
   npm start
   ```
