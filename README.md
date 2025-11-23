 🎭 EmoVision Chrome Extension

Real-time emotion detection for Google Meet, Zoom, and all video platforms

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)

---

 📦 Quick Start for Users

 Download & Install

1. Download the extension:
   ```bash
   git clone https://github.com/Jordan-Townsend/emovision-chrome-extension.git
   cd emovision-chrome-extension/extensions/emotion-detector
   ```

2. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extensions/emotion-detector` folder
   - Extension should appear in your toolbar! Doublecheck settings if not.

3. Start Using:
   - Join a Google Meet or Zoom call
   - Emotion badges appear automatically above faces
   - For Zoom: Grant tab capture permission when prompted

---

 📂 Folder Structure

```
extensions/
└── emotion-detector/          ← The Chrome extension (ready to install)
    ├── README.md             ← Full documentation
    ├── ZOOM_FIX_INSTRUCTIONS.md  ← Zoom troubleshooting
    ├── manifest.json         ← Extension manifest
    ├── content.js           ← Main detection logic
    ├── background.js        ← Service worker
    ├── popup.html/js/css    ← Extension settings UI
    ├── styles.css           ← Overlay styles
    ├── libs/                ← TensorFlow.js libraries
    │   ├── face-api.min.js
    │   ├── tf-*.min.js
    │   └── pose-detection.min.js
    └── images/              ← Extension icons
        ├── icon-16.png
        ├── icon-48.png
        └── icon-128.png
```

---

 ✨ Features

- 🚀 Instant Detection - Real-time at 10 FPS, <100ms latency
- 🌐 Universal - Works on Meet, Zoom, Teams, and more
- 🎯 Clean UI - Minimalist badges that don't block view
- 👥 Unlimited Faces - Detects multiple people
- 🔒 Private - All processing in your browser
- ⚡ Fast - Client-side TensorFlow.js

---

 🎯 Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Google Meet | ✅ Works perfectly | Instant detection |
| Zoom | ✅ Works (needs permission) | Tab capture required |
| Microsoft Teams | ✅ Should work | Direct detection |
| YouTube/Twitch | Works perfectly | Instant detection |
---

 📖 Full Documentation

See `emotion-detector/README.md` for:
- Detailed installation guide
- Troubleshooting steps
- Configuration options
- Technical architecture
- Performance benchmarks

See `emotion-detector/ZOOM_FIX_INSTRUCTIONS.md` for:
- Zoom-specific setup
- Tab capture permission guide
- Zoom debugging steps

---

 🔧 For Developers

 Local Development
1. Clone this repository
2. Make changes to files in `emotion-detector/`
3. Go to `chrome://extensions/` → Click Reload on the extension
4. Hard refresh your test page (`Ctrl+Shift+R`)

 Testing
- Google Meet: Create test meeting, check console logs
- Zoom: Join meeting, grant permission, check console
- Console: Look for `[EmoVision]` messages

---

 🆘 Need Help?

- Issues: [GitHub Issues](https://github.com/jordan-townsend/emovision/issues)
- Email: jordan@townsendsdesigns.com
- Docs: See README.md in `emotion-detector/` folder

---

 📝 License

MIT License - See LICENSE file for details

---

Made with ❤️ by the EmoVision Team

⭐ Star us on GitHub if you find this useful!
