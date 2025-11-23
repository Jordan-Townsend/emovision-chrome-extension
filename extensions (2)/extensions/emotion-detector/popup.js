// EmoVision Extension - Popup Script v2.0

let currentURL = '';
let currentDomain = '';

document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
  // Get current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      currentURL = tabs[0].url || '';
      currentDomain = extractDomain(currentURL);
      updatePlatformInfo();
      loadSettings();
      updateSiteStatus();
    }
  });
  
  // Setup event listeners
  const toggleSite = document.getElementById('toggleSite');
  const addToWhitelist = document.getElementById('addToWhitelist');
  const addToBlacklist = document.getElementById('addToBlacklist');
  const globalToggle = document.getElementById('globalToggle');
  const saveSettings = document.getElementById('saveSettings');
  
  if (toggleSite) toggleSite.addEventListener('click', toggleCurrentSite);
  if (addToWhitelist) addToWhitelist.addEventListener('click', addCurrentToWhitelist);
  if (addToBlacklist) addToBlacklist.addEventListener('click', addCurrentToBlacklist);
  if (globalToggle) globalToggle.addEventListener('change', toggleGlobalDetection);
  if (saveSettings) saveSettings.addEventListener('click', saveSettings_click);
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return '';
  }
}

function updatePlatformInfo() {
  const url = currentURL;
  let platform = currentDomain;
  
  if (url.includes('meet.google.com')) platform = '🎥 Google Meet';
  else if (url.includes('zoom.us')) platform = '🎥 Zoom';
  else if (url.includes('teams.microsoft.com')) platform = '🎥 Microsoft Teams';
  else if (url.includes('youtube.com')) platform = '📺 YouTube';
  else if (url.includes('twitch.tv')) platform = '🎮 Twitch';
  else if (url.includes('vimeo.com')) platform = '🎬 Vimeo';
  else platform = '🌐 ' + currentDomain;
  
  document.getElementById('platform').textContent = platform;
}

function loadSettings() {
  chrome.storage.sync.get(
    ['globalToggle', 'backendURL', 'whitelist', 'blacklist', 'siteSettings'],
    (result) => {
      const globalToggle = document.getElementById('globalToggle');
      if (globalToggle) {
        globalToggle.checked = result.globalToggle !== false;
      }
      
      const backendURL = document.getElementById('backendURL');
      if (backendURL) {
        backendURL.value = result.backendURL || 'https://emovision.net';
      }
      
      // Update whitelist/blacklist displays
      updateWhitelistDisplay(result.whitelist || []);
      updateBlacklistDisplay(result.blacklist || []);
    }
  );
}

function updateSiteStatus() {
  chrome.runtime.sendMessage({
    action: 'checkSiteStatus',
    url: currentURL
  }, (response) => {
    const statusBadge = document.getElementById('statusBadge');
    const toggleBtn = document.getElementById('toggleSite');
    
    if (response && response.enabled) {
      if (statusBadge) {
        statusBadge.textContent = '✅ Active';
        statusBadge.className = 'status-badge status-active';
      }
      if (toggleBtn) {
        toggleBtn.textContent = 'Disable on This Site';
        toggleBtn.className = 'btn btn-primary btn-danger';
      }
    } else {
      if (statusBadge) {
        statusBadge.textContent = '⏸️ Not Active';
        statusBadge.className = 'status-badge status-inactive';
      }
      if (toggleBtn) {
        toggleBtn.textContent = 'Enable on This Site';
        toggleBtn.className = 'btn btn-primary';
      }
    }
  });
}

function toggleGlobalDetection(event) {
  const enabled = event.target.checked;
  chrome.storage.sync.set({ globalToggle: enabled });
  
  // Notify content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleEmotionDetection',
        enabled: enabled
      }).catch(() => {});
    }
  });
  
  updateSiteStatus();
}

function toggleCurrentSite() {
  if (!currentDomain) {
    showMessage('Could not detect domain', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'checkSiteStatus',
    url: currentURL
  }, (response) => {
    const newState = !(response && response.enabled);
    
    // Save per-site setting
    chrome.storage.sync.get(['siteSettings'], (result) => {
      const siteSettings = result.siteSettings || {};
      siteSettings[currentDomain] = newState;
      chrome.storage.sync.set({ siteSettings });
      
      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleEmotionDetection',
            enabled: newState
          }).catch(() => {});
        }
      });
      
      updateSiteStatus();
      showMessage(newState ? 'Enabled on this site!' : 'Disabled on this site!', 'success');
    });
  });
}

function addCurrentToWhitelist() {
  if (!currentDomain) {
    showMessage('Could not detect domain', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'addToWhitelist',
    url: currentURL
  }, (response) => {
    if (response && response.success) {
      showMessage(`Added ${currentDomain} to whitelist!`, 'success');
      loadSettings();
      updateSiteStatus();
    } else {
      showMessage('Already in whitelist', 'info');
    }
  });
}

function addCurrentToBlacklist() {
  if (!currentDomain) {
    showMessage('Could not detect domain', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'addToBlacklist',
    url: currentURL
  }, (response) => {
    if (response && response.success) {
      showMessage(`Added ${currentDomain} to blacklist!`, 'success');
      loadSettings();
      updateSiteStatus();
    } else {
      showMessage('Already in blacklist', 'info');
    }
  });
}

function updateWhitelistDisplay(whitelist) {
  const container = document.getElementById('whitelistItems');
  const count = document.getElementById('whitelistCount');
  
  if (!container || !count) return;
  
  count.textContent = whitelist.length;
  
  if (whitelist.length === 0) {
    container.innerHTML = '<p class="empty-state">No sites in whitelist</p>';
    return;
  }
  
  container.innerHTML = whitelist.map(domain => `
    <div class="list-item">
      <span class="list-item-text">${domain}</span>
      <button class="list-item-remove" data-domain="${domain}" data-type="whitelist">×</button>
    </div>
  `).join('');
  
  // Add remove listeners
  container.querySelectorAll('.list-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromList(btn.dataset.domain, btn.dataset.type));
  });
}

function updateBlacklistDisplay(blacklist) {
  const container = document.getElementById('blacklistItems');
  const count = document.getElementById('blacklistCount');
  
  if (!container || !count) return;
  
  count.textContent = blacklist.length;
  
  if (blacklist.length === 0) {
    container.innerHTML = '<p class="empty-state">No sites blacklisted</p>';
    return;
  }
  
  container.innerHTML = blacklist.map(domain => `
    <div class="list-item">
      <span class="list-item-text">${domain}</span>
      <button class="list-item-remove" data-domain="${domain}" data-type="blacklist">×</button>
    </div>
  `).join('');
  
  // Add remove listeners
  container.querySelectorAll('.list-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromList(btn.dataset.domain, btn.dataset.type));
  });
}

function removeFromList(domain, type) {
  const storageKey = type === 'whitelist' ? 'whitelist' : 'blacklist';
  
  chrome.storage.sync.get([storageKey], (result) => {
    const list = result[storageKey] || [];
    const filtered = list.filter(d => d !== domain);
    
    chrome.storage.sync.set({ [storageKey]: filtered }, () => {
      showMessage(`Removed ${domain} from ${type}!`, 'success');
      loadSettings();
      updateSiteStatus();
    });
  });
}

function saveSettings_click() {
  const backendURL = document.getElementById('backendURL');
  if (!backendURL) return;
  
  const url = backendURL.value;
  
  // Validate URL
  if (url && !isValidURL(url)) {
    showMessage('Invalid URL format', 'error');
    return;
  }
  
  // Save settings
  chrome.storage.sync.set({ backendURL: url });
  
  // Show success message
  showMessage('Settings saved!', 'success');
}

function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function showMessage(text, type) {
  const button = document.getElementById('saveSettings');
  if (!button) return;
  
  const originalText = button.textContent;
  
  button.textContent = text;
  button.style.backgroundColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#FF6B6B' : '#667eea';
  
  setTimeout(() => {
    button.textContent = originalText;
    button.style.backgroundColor = '';
  }, 2000);
}


// YouTube Analysis
async function analyzeYouTubeVideo() {
  const urlInput = document.getElementById('youtubeURL');
  const analyzeBtn = document.getElementById('analyzeYoutube');
  const statusDiv = document.getElementById('youtubeStatus');
  const resultsDiv = document.getElementById('youtubeResults');
  
  if (!urlInput) return;
  
  const url = urlInput.value.trim();
  if (!url) {
    showMessage('Please enter a video URL', 'error');
    return;
  }
  
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isTwitch = url.includes('twitch.tv');
  
  if (!isYouTube && !isTwitch) {
    showMessage('Please enter a valid YouTube or Twitch URL', 'error');
    return;
  }
  
  try {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    statusDiv.style.display = 'block';
    statusDiv.textContent = '⏳ Downloading and analyzing video...';
    statusDiv.className = 'status-message info';
    resultsDiv.style.display = 'none';
    
    const result = await chrome.storage.sync.get(['backendURL']);
    const backendURL = result.backendURL || 'https://emovision.net';
    
    const response = await fetch(`${backendURL}/api/youtube/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      statusDiv.textContent = '✅ Analysis complete!';
      statusDiv.className = 'status-message success';
      
      const { video_info, analysis } = data;
      let html = `
        <div class="results-header">
          <h4>${video_info.title}</h4>
          <p>${video_info.duration}s | ${analysis.total_detections} faces detected</p>
        </div>
        <div class="timeline">
      `;
      
      analysis.results.forEach(r => {
        const m = Math.floor(r.timestamp / 60);
        const s = Math.floor(r.timestamp % 60);
        const time = `${m}:${s.toString().padStart(2, '0')}`;
        
        r.faces.forEach(f => {
          const emoji = { happy: '😊', sad: '😢', angry: '😠', fear: '😨', surprise: '😮', disgust: '🤢', neutral: '😐' }[f.dominant_emotion] || '👤';
          html += `<div class="timeline-item"><span>${time}</span> <span>${emoji} ${f.dominant_emotion}</span></div>`;
        });
      });
      
      html += '</div>';
      resultsDiv.innerHTML = html;
      resultsDiv.style.display = 'block';
    } else {
      throw new Error(data.message || 'Analysis failed');
    }
  } catch (error) {
    statusDiv.textContent = `❌ Error: ${error.message}`;
    statusDiv.className = 'status-message error';
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze';
  }
}

// Add YouTube listener
const analyzeBtn = document.getElementById('analyzeYoutube');
if (analyzeBtn) {
  analyzeBtn.addEventListener('click', analyzeYouTubeVideo);
}

