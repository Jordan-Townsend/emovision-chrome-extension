// EmoVision - Instant Webcam Detection (Mode A) + Backend URL Processing
// Instant detection for video calls, backend processing for YouTube URLs

console.log('[EmoVision] 🚀 Loading instant webcam detection...');

// Configuration
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
const DETECTION_FPS = 10; // 10 FPS for smooth performance
const FRAME_INTERVAL_MS = 1000 / DETECTION_FPS;

// State
let modelsLoaded = false;
let tfBackendReady = false;
let poseDetector = null;
let isEnabled = true;
let activeVideos = new Map(); // video -> state
let overlayContainer = null;
let zoomDetectionAttempts = 0;
let zoomCaptureActive = false;
let hiddenZoomVideo = null;

const EMOTION_EMOJI = {
  happy: '😊', sad: '😢', angry: '😠', surprised: '😮',
  fearful: '😨', disgusted: '🤢', neutral: '😐'
};

const POSE_CONNECTIONS = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16]
];

// Initialize
async function initialize() {
  console.log('[EmoVision] Initializing...');
  
  await initializeTensorFlow();
  setupOverlay();
  await loadModels();
  detectVideos();
  
  const observer = new MutationObserver(detectVideos);
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Zoom-specific: If no videos found after 3 seconds, try tab capture
  setTimeout(() => {
    if (activeVideos.size === 0 && isZoomPage()) {
      console.log('[EmoVision] 🔍 No videos found on Zoom - trying tab capture...');
      startZoomTabCapture();
    }
  }, 3000);
  
  console.log('[EmoVision] ✅ Ready for webcam detection');
}

// Check if current page is Zoom
function isZoomPage() {
  return window.location.hostname.includes('zoom.us');
}

// Initialize TensorFlow WebGL
async function initializeTensorFlow() {
  try {
    if (typeof tf === 'undefined') {
      console.error('[EmoVision] ❌ TensorFlow.js not loaded');
      return;
    }
    
    await tf.setBackend('webgl');
    await tf.ready();
    console.log(`[EmoVision] ✅ TF Backend: ${tf.getBackend()}`);
    tfBackendReady = true;
  } catch (err) {
    console.error('[EmoVision] ❌ TF init failed:', err);
  }
}

// Setup overlay container
function setupOverlay() {
  if (overlayContainer) return;
  
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'emovision-overlay';
  overlayContainer.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none; z-index: 999999;
  `;
  document.body.appendChild(overlayContainer);
  console.log('[EmoVision] ✅ Overlay created');
}

// Load models
async function loadModels() {
  if (modelsLoaded) return;
  
  try {
    console.log('[EmoVision] Loading models...');
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
    ]);
    console.log('[EmoVision] ✅ Face models loaded');
    
    poseDetector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true
      }
    );
    console.log('[EmoVision] ✅ Pose model loaded');
    modelsLoaded = true;
  } catch (err) {
    console.error('[EmoVision] ❌ Model load failed:', err);
  }
}

// Detect webcam videos
function detectVideos() {
  // Standard video elements
  const videos = document.querySelectorAll('video');
  
  videos.forEach(video => {
    if (!activeVideos.has(video) && isWebcamVideo(video) && video.readyState >= 2) {
      const state = {
        frameCanvas: document.createElement('canvas'),
        frameCtx: null,
        overlays: { badges: [], skeletonCanvas: null, poseLabel: null },
        lastDetections: null,
        lastPoses: null
      };
      
      state.frameCtx = state.frameCanvas.getContext('2d', { willReadFrequently: true });
      activeVideos.set(video, state);
      
      startWebcamDetection(video, state);
      console.log('[EmoVision] ✅ Started webcam detection');
    }
  });
  
  // Zoom-specific: Check shadow DOM for video elements
  const zoomContainers = document.querySelectorAll('[class*="video-container"], [class*="participant-video"], [class*="video-layout"], [class*="video-player"]');
  zoomContainers.forEach(container => {
    if (container.shadowRoot) {
      const shadowVideos = container.shadowRoot.querySelectorAll('video');
      shadowVideos.forEach(video => {
        if (!activeVideos.has(video) && isWebcamVideo(video) && video.readyState >= 2) {
          const state = {
            frameCanvas: document.createElement('canvas'),
            frameCtx: null,
            overlays: { badges: [], skeletonCanvas: null, poseLabel: null },
            lastDetections: null,
            lastPoses: null
          };
          
          state.frameCtx = state.frameCanvas.getContext('2d', { willReadFrequently: true });
          activeVideos.set(video, state);
          
          startWebcamDetection(video, state);
          console.log('[EmoVision] ✅ Started Zoom shadow DOM video detection');
        }
      });
    }
  });
}

// Check if video is webcam/getUserMedia stream
function isWebcamVideo(video) {
  if (!video || !video.videoWidth || !video.videoHeight) return false;
  
  // Check if it's a MediaStream (video calls, webcams) - prioritize this
  if (video.srcObject && video.srcObject instanceof MediaStream) {
    console.log('[EmoVision] ✅ MediaStream detected (video call)');
    return true;
  }
  
  // Check for blob URLs (Zoom sometimes uses these)
  if (video.src && video.src.startsWith('blob:')) {
    console.log('[EmoVision] ✅ Blob URL detected (likely Zoom)');
    return true;
  }
  
  // Also detect if we can access pixels (same-origin)
  const testCanvas = document.createElement('canvas');
  const testCtx = testCanvas.getContext('2d');
  testCanvas.width = 1;
  testCanvas.height = 1;
  
  try {
    testCtx.drawImage(video, 0, 0, 1, 1);
    // If successful, we can process this video
    console.log('[EmoVision] ✅ Same-origin video accessible');
    return true;
  } catch (e) {
    // Cross-origin - skip (user should use URL processing feature)
    console.log('[EmoVision] ⏭️ Skipping cross-origin video:', e.message);
    return false;
  }
}

// Start webcam detection with frame sync
function startWebcamDetection(video, state) {
  let lastDetectionTime = 0;
  
  function onFrame(now, metadata) {
    if (!activeVideos.has(video) || !isEnabled) {
      if (activeVideos.has(video)) {
        video.requestVideoFrameCallback(onFrame);
      }
      return;
    }
    
    const timeSinceLastDetection = now - lastDetectionTime;
    
    if (timeSinceLastDetection >= FRAME_INTERVAL_MS && modelsLoaded && tfBackendReady) {
      lastDetectionTime = now;
      processFrame(video, state).catch(err => {
        console.error('[EmoVision] Frame error:', err);
      });
    } else if (state.lastDetections) {
      // Update overlay positions with last detections
      updateOverlays(video, state);
    }
    
    video.requestVideoFrameCallback(onFrame);
  }
  
  video.requestVideoFrameCallback(onFrame);
  console.log('[EmoVision] ✅ Frame-sync active');
}

// Process frame (hybrid two-stage detection)
async function processFrame(video, state) {
  const startTime = performance.now();
  
  try {
    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    // Capture frame (downscale for performance)
    const targetWidth = Math.min(640, video.videoWidth);
    const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;
    
    state.frameCanvas.width = targetWidth;
    state.frameCanvas.height = targetHeight;
    state.frameCtx.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    // Initialize fallback state
    if (!state.noFaceCount) state.noFaceCount = 0;
    if (!state.lastSSDCheck) state.lastSSDCheck = 0;
    
    // Stage 1: Fast TinyFaceDetector (optimized for multi-angle)
    let faces = await faceapi
      .detectAllFaces(state.frameCanvas, new faceapi.TinyFaceDetectorOptions({
        inputSize: 256,  // Increased from 192 for better angle coverage
        scoreThreshold: 0.4  // Lowered from 0.5 to catch more angles
      }))
      .withFaceExpressions();
    
    // Stage 2: SSD MobileNet fallback for difficult angles
    if (faces.length === 0) {
      state.noFaceCount++;
      
      // Trigger SSD after 2 consecutive failures, max 5 FPS
      const now = performance.now();
      if (state.noFaceCount >= 2 && (now - state.lastSSDCheck) > 200) {
        console.log('[EmoVision] 🔍 Trying SSD MobileNet for difficult angles...');
        state.lastSSDCheck = now;
        
        // Try SSD MobileNet (better at profiles/tilted heads)
        faces = await faceapi
          .detectAllFaces(state.frameCanvas, new faceapi.SsdMobilenetv1Options({
            minConfidence: 0.3  // Lower threshold for side angles
          }))
          .withFaceExpressions();
        
        if (faces.length > 0) {
          console.log(`[EmoVision] ✅ SSD found ${faces.length} face(s) at difficult angle`);
        }
      }
    } else {
      state.noFaceCount = 0;  // Reset counter on success
    }
    
    // Detect pose
    const poses = await poseDetector.estimatePoses(state.frameCanvas);
    
    // Store results
    state.lastDetections = faces;
    state.lastPoses = poses;
    
    // Render overlays
    renderOverlays(video, rect, faces, poses, state);
    
    const elapsed = performance.now() - startTime;
    if (faces.length > 0) {
      console.log(`[EmoVision] ${elapsed.toFixed(1)}ms | ${faces.length} face(s)`);
    }
    
  } catch (err) {
    console.error('[EmoVision] Process error:', err);
  }
}

// Update overlay positions
function updateOverlays(video, state) {
  if (!state.lastDetections) return;
  const rect = video.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  renderOverlays(video, rect, state.lastDetections, state.lastPoses, state);
}

// Render overlays
function renderOverlays(video, videoRect, faces, poses, state) {
  const { overlays } = state;
  const scaleX = video.videoWidth / state.frameCanvas.width;
  const scaleY = video.videoHeight / state.frameCanvas.height;
  
  // Emotion badges
  faces.forEach((face, i) => {
    const box = face.detection.box;
    const expressions = face.expressions;
    
    const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
    const [emotion, conf] = sorted[0];
    
    const x = videoRect.left + ((box.x * scaleX) / video.videoWidth) * videoRect.width;
    const y = videoRect.top + ((box.y * scaleY) / video.videoHeight) * videoRect.height;
    
    let badge = overlays.badges[i];
    if (!badge) {
      badge = document.createElement('div');
      badge.style.cssText = `
        position: fixed;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white; padding: 6px 12px;
        border-radius: 8px; font-size: 14px; font-weight: 600;
        font-family: system-ui; pointer-events: none;
        z-index: 1000000; white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        border: 2px solid rgba(255,255,255,0.3);
        transition: transform 0.1s ease-out;
      `;
      overlayContainer.appendChild(badge);
      overlays.badges[i] = badge;
    }
    
    badge.style.transform = `translate(${x}px, ${y - 35}px)`;
    badge.textContent = `${EMOTION_EMOJI[emotion]} ${emotion} ${Math.round(conf * 100)}%`;
    badge.style.display = 'block';
  });
  
  for (let i = faces.length; i < overlays.badges.length; i++) {
    overlays.badges[i].style.display = 'none';
  }
  
  // Hide skeleton canvas and pose label (disabled for cleaner viewing)
  if (overlays.skeletonCanvas) {
    overlays.skeletonCanvas.style.display = 'none';
  }
  if (overlays.poseLabel) {
    overlays.poseLabel.style.display = 'none';
  }
  
  // Pose skeleton - DISABLED for cleaner viewing
  // Body language data is still collected in the background
  if (false && poses && poses.length > 0 && poses[0].score > 0.3) {
    const pose = poses[0];
    
    if (!overlays.skeletonCanvas) {
      overlays.skeletonCanvas = document.createElement('canvas');
      overlays.skeletonCanvas.style.cssText = `
        position: fixed; pointer-events: none; z-index: 999999;
      `;
      overlayContainer.appendChild(overlays.skeletonCanvas);
    }
    
    const canvas = overlays.skeletonCanvas;
    canvas.width = videoRect.width;
    canvas.height = videoRect.height;
    canvas.style.left = `${videoRect.left}px`;
    canvas.style.top = `${videoRect.top}px`;
    canvas.style.display = 'block';
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw keypoints
    pose.keypoints.forEach(kp => {
      if (kp.score > 0.3) {
        const x = ((kp.x * scaleX) / video.videoWidth) * videoRect.width;
        const y = ((kp.y * scaleY) / video.videoHeight) * videoRect.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#00ff00';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // Draw skeleton
    POSE_CONNECTIONS.forEach(([i, j]) => {
      const kp1 = pose.keypoints[i];
      const kp2 = pose.keypoints[j];
      
      if (kp1.score > 0.3 && kp2.score > 0.3) {
        const x1 = ((kp1.x * scaleX) / video.videoWidth) * videoRect.width;
        const y1 = ((kp1.y * scaleY) / video.videoHeight) * videoRect.height;
        const x2 = ((kp2.x * scaleX) / video.videoWidth) * videoRect.width;
        const y2 = ((kp2.y * scaleY) / video.videoHeight) * videoRect.height;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
    
    // Body language label
    const label = getPoseLabel(pose);
    if (label) {
      const nose = pose.keypoints[0];
      if (nose.score > 0.3) {
        const x = videoRect.left + ((nose.x * scaleX) / video.videoWidth) * videoRect.width;
        const y = videoRect.top + ((nose.y * scaleY) / video.videoHeight) * videoRect.height;
        
        if (!overlays.poseLabel) {
          overlays.poseLabel = document.createElement('div');
          overlays.poseLabel.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, #11998e, #38ef7d);
            color: white; padding: 6px 12px;
            border-radius: 8px; font-size: 13px; font-weight: 600;
            font-family: system-ui; pointer-events: none;
            z-index: 1000001; white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            border: 2px solid rgba(255,255,255,0.3);
            transition: transform 0.1s ease-out;
          `;
          overlayContainer.appendChild(overlays.poseLabel);
        }
        
        overlays.poseLabel.style.transform = `translate(${x}px, ${y - 60}px)`;
        overlays.poseLabel.textContent = `🧘 ${label}`;
        overlays.poseLabel.style.display = 'block';
      }
    } else if (overlays.poseLabel) {
      overlays.poseLabel.style.display = 'none';
    }
  } else if (overlays.skeletonCanvas) {
    overlays.skeletonCanvas.style.display = 'none';
    if (overlays.poseLabel) overlays.poseLabel.style.display = 'none';
  }
}

// Get pose label
function getPoseLabel(pose) {
  const kp = pose.keypoints;
  const leftHip = kp[11], rightHip = kp[12];
  const leftKnee = kp[13], rightKnee = kp[14];
  
  if (leftHip.score > 0.5 && rightHip.score > 0.5 && leftKnee.score > 0.5 && rightKnee.score > 0.5) {
    const hipY = (leftHip.y + rightHip.y) / 2;
    const kneeY = (leftKnee.y + rightKnee.y) / 2;
    if (Math.abs(hipY - kneeY) < 50) return 'Sitting';
    return 'Standing';
  }
  
  const leftWrist = kp[9], rightWrist = kp[10];
  const leftShoulder = kp[5], rightShoulder = kp[6];
  
  if (leftWrist.score > 0.5 && rightWrist.score > 0.5 && leftShoulder.score > 0.5 && rightShoulder.score > 0.5) {
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const wristY = (leftWrist.y + rightWrist.y) / 2;
    if (wristY < shoulderY - 50) return 'Arms Raised';
  }
  
  return null;
}

// Message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'setEnabled') {
    isEnabled = msg.enabled;
    if (!isEnabled) {
      activeVideos.forEach(state => {
        state.overlays.badges.forEach(b => b.style.display = 'none');
        if (state.overlays.skeletonCanvas) state.overlays.skeletonCanvas.style.display = 'none';
        if (state.overlays.poseLabel) state.overlays.poseLabel.style.display = 'none';
      });
    }
    sendResponse({ success: true });
  }
});

// Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log('[EmoVision] Webcam detection ready');

// Zoom tab capture fallback
async function startZoomTabCapture() {
  if (zoomCaptureActive) {
    console.log('[EmoVision] Tab capture already active');
    return;
  }
  
  console.log('[EmoVision] 📹 Requesting tab capture for Zoom...');
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'requestTabCapture' });
    
    if (!response.success) {
      console.error('[EmoVision] ❌ Tab capture failed:', response.error);
      return;
    }
    
    if (!response.stream) {
      console.error('[EmoVision] ❌ No stream in response');
      return;
    }
    
    console.log('[EmoVision] ✅ Tab capture stream received');
    zoomCaptureActive = true;
    
    // Create hidden video element to process the stream
    hiddenZoomVideo = document.createElement('video');
    hiddenZoomVideo.srcObject = response.stream;
    hiddenZoomVideo.autoplay = true;
    hiddenZoomVideo.muted = true;
    hiddenZoomVideo.style.cssText = 'position: fixed; top: -9999px; left: -9999px;';
    document.body.appendChild(hiddenZoomVideo);
    
    // Wait for video to be ready
    hiddenZoomVideo.onloadedmetadata = () => {
      console.log('[EmoVision] ✅ Zoom capture video ready:', hiddenZoomVideo.videoWidth, 'x', hiddenZoomVideo.videoHeight);
      
      // Start processing this video
      const state = {
        frameCanvas: document.createElement('canvas'),
        frameCtx: null,
        overlays: { badges: [], skeletonCanvas: null, poseLabel: null },
        lastDetections: null,
        lastPoses: null,
        isZoomCapture: true  // Flag to handle coordinate scaling differently
      };
      
      state.frameCtx = state.frameCanvas.getContext('2d', { willReadFrequently: true });
      activeVideos.set(hiddenZoomVideo, state);
      
      startWebcamDetection(hiddenZoomVideo, state);
      console.log('[EmoVision] ✅ Started Zoom tab capture detection');
    };
    
    hiddenZoomVideo.onerror = (err) => {
      console.error('[EmoVision] ❌ Hidden video error:', err);
    };
    
  } catch (error) {
    console.error('[EmoVision] ❌ Tab capture error:', error);
  }
}

