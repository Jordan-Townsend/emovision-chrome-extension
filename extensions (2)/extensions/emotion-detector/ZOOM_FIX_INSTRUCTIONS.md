# 🔧 Zoom Fix - Tab Capture Method

## What Changed:

Zoom doesn't use standard `<video>` elements - it renders through protected WebGL/canvas. The extension now uses **Chrome Tab Capture** to capture the entire Zoom tab and process it for emotion detection.

---

## 🔄 **RELOAD INSTRUCTIONS (IMPORTANT!)**

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find **"EmoVision - Instant Emotion & Body Language"**
3. Click the **🔄 Reload** button
4. **IMPORTANT:** You may see a permission prompt - **CLICK ALLOW!**

### Step 2: Hard Refresh Zoom
1. Go to your Zoom meeting tab
2. Press **`Ctrl+Shift+R`** (Windows/Linux) or **`Cmd+Shift+R`** (Mac)
3. **Close and rejoin** the meeting if needed

### Step 3: Grant Tab Capture Permission
When you join/rejoin the Zoom meeting:
1. Extension will detect Zoom
2. After 3 seconds (if no `<video>` found), it will request tab capture
3. **Chrome will show a permission dialog**
4. **Click "Share" or "Allow"** to grant tab capture access

---

## 📊 **What You'll See in Console:**

### ✅ **Success Logs (What to Expect):**
```
[EmoVision] Initializing...
[EmoVision] ✅ TF Backend: webgl
[EmoVision] ✅ Face models loaded
[EmoVision] ✅ Pose model loaded
[EmoVision] 🔍 No videos found on Zoom - trying tab capture...
[EmoVision] 📹 Requesting tab capture for Zoom...
[EmoVision] ✅ Tab capture stream received
[EmoVision] ✅ Zoom capture video ready: 1280 x 720
[EmoVision] ✅ Started Zoom tab capture detection
[EmoVision] 45.2ms | 2 face(s)
```

### ❌ **If You See Errors:**
```
[EmoVision] ❌ Tab capture failed: Extension does not have permission
```
**Solution:** You denied the permission. Reload extension and try again.

```
[EmoVision] ❌ No stream in response
```
**Solution:** Make sure you're on Zoom and the meeting is active.

---

## 🎯 **How It Works:**

### **Google Meet:**
- Uses standard `<video>` elements
- Direct detection, instant overlays
- No permissions needed

### **Zoom (New Method):**
1. Extension detects Zoom URL
2. Waits 3 seconds for `<video>` elements
3. If none found, requests tab capture
4. Chrome asks permission (one-time per meeting)
5. Creates hidden video element from tab stream
6. Processes that stream for emotions
7. Overlays badges on the visible Zoom window

---

## ⚙️ **Technical Details:**

**Tab Capture Settings:**
- Resolution: 1280x720 max (good quality + performance)
- Frame Rate: 30 FPS
- Downscale: 640px for processing (fast)
- Audio: Disabled (we only need video)

**Coordinate Scaling:**
- Extension captures entire tab
- Emotions map to visible Zoom tiles
- Automatic scaling to window size

---

## 🐛 **Troubleshooting:**

### **No Permission Dialog Appears:**
- Reload extension completely
- Close and reopen Zoom tab
- Make sure you're in an active meeting

### **Permission Dialog Appears But Nothing Happens:**
- Check console for errors
- Make sure TensorFlow loaded (`✅ TF Backend: webgl`)
- Try refreshing Zoom one more time

### **Badges Appear in Wrong Position:**
- This is a known issue with tab capture (we're capturing the whole tab)
- Refreshing may help recalculate positions

### **Still No Detection:**
Open DevTools console (`F12`) and share these logs:
- All lines starting with `[EmoVision]`
- Any error messages (red text)

---

## ✨ **Expected Behavior:**

Once working correctly:
- **Join Zoom meeting** → Wait 3 seconds
- **Permission dialog** → Click "Share/Allow"
- **Emotion badges appear** within 1-2 seconds
- **Updates in real-time** as people talk
- **Works for all participants** (gallery view)

---

## 🎉 **Success Checklist:**

- [ ] Extension reloaded in `chrome://extensions/`
- [ ] Zoom tab hard refreshed (`Ctrl+Shift+R`)
- [ ] Permission dialog appeared when joining meeting
- [ ] Clicked "Share/Allow" on permission dialog
- [ ] Console shows "✅ Zoom capture video ready"
- [ ] Emotion badges visible above participant faces

---

## 📝 **Note:**

This is a **one-time permission per meeting**. Once granted:
- ✅ Works for the entire meeting duration
- ✅ Persists if you close/reopen DevTools
- ❌ Needs re-grant if you leave and rejoin meeting
- ❌ Needs re-grant if you close/reopen Zoom tab

---

**This should fix Zoom completely!** The tab capture method is the only reliable way to process Zoom's protected video rendering. 🚀
