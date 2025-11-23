// EmoVision Extension - Background Service Worker

console.log('🔧 EmoVision background service worker initialized');

// Initialize default settings with whitelist/blacklist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['whitelist', 'blacklist'], (result) => {
    const defaults = {
      emotionDetectionEnabled: true,
      globalToggle: true,
      backendURL: 'https://9742a0d4-750c-48c5-9d23-7c0a6ae999e6-00-2sc0g2z8gcsft.worf.replit.dev',
      syncEnabled: false,
      theme: 'dark',
      whitelist: result.whitelist || [
        'meet.google.com',
        'zoom.us',
        'teams.microsoft.com'
      ],
      blacklist: result.blacklist || [],
      siteSettings: {}
    };
    
    chrome.storage.sync.set(defaults);
    console.log('✅ Extension initialized with whitelist/blacklist system');
  });
});

// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

// Check if site should have detection enabled
async function shouldEnableDetection(url) {
  const domain = extractDomain(url);
  if (!domain) return false;
  
  return new Promise((resolve) => {
    chrome.storage.sync.get(['globalToggle', 'whitelist', 'blacklist', 'siteSettings'], (result) => {
      const globalToggle = result.globalToggle !== false;
      const whitelist = result.whitelist || [];
      const blacklist = result.blacklist || [];
      const siteSettings = result.siteSettings || {};
      
      // Check blacklist first (highest priority)
      if (blacklist.some(d => domain.includes(d))) {
        console.log(`🚫 ${domain} is blacklisted`);
        resolve(false);
        return;
      }
      
      // Check per-site settings
      if (siteSettings[domain] !== undefined) {
        console.log(`⚙️ ${domain} has custom setting: ${siteSettings[domain]}`);
        resolve(siteSettings[domain] && globalToggle);
        return;
      }
      
      // Check whitelist
      const isWhitelisted = whitelist.some(d => domain.includes(d));
      console.log(`${isWhitelisted ? '✅' : '⏸️'} ${domain} ${isWhitelisted ? 'is whitelisted' : 'not in whitelist'}`);
      resolve(isWhitelisted && globalToggle);
    });
  });
}

// Track when user navigates to new pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const shouldEnable = await shouldEnableDetection(tab.url);
    
    if (shouldEnable) {
      const domain = extractDomain(tab.url);
      console.log(`📹 Auto-enabling detection on ${domain}`);
      
      chrome.tabs.sendMessage(tabId, { 
        action: 'toggleEmotionDetection', 
        enabled: true 
      }).catch(() => {
        // Content script might not be ready yet
      });
    }
  }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'requestTabCapture') {
    // Request tab capture for cross-origin videos (YouTube, Twitch, etc.)
    chrome.tabCapture.capture(
      {
        audio: false,
        video: true
      },
      (stream) => {
        if (chrome.runtime.lastError) {
          console.error('[EmoVision] Tab capture error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else if (stream) {
          // Generate stream ID
          const streamId = stream.id || Date.now().toString();
          console.log('[EmoVision] ✅ Tab capture granted');
          sendResponse({ success: true, streamId, stream });
        } else {
          sendResponse({ success: false, error: 'No stream available' });
        }
      }
    );
    return true; // Keep channel open
  } else if (request.action === 'checkSiteStatus') {
    shouldEnableDetection(request.url).then(enabled => {
      sendResponse({ enabled });
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'addToWhitelist') {
    chrome.storage.sync.get(['whitelist'], (result) => {
      const whitelist = result.whitelist || [];
      const domain = extractDomain(request.url);
      if (domain && !whitelist.includes(domain)) {
        whitelist.push(domain);
        chrome.storage.sync.set({ whitelist }, () => {
          sendResponse({ success: true, domain });
        });
      } else {
        sendResponse({ success: false, reason: 'Already in whitelist' });
      }
    });
    return true;
  } else if (request.action === 'addToBlacklist') {
    chrome.storage.sync.get(['blacklist'], (result) => {
      const blacklist = result.blacklist || [];
      const domain = extractDomain(request.url);
      if (domain && !blacklist.includes(domain)) {
        blacklist.push(domain);
        chrome.storage.sync.set({ blacklist }, () => {
          sendResponse({ success: true, domain });
        });
      } else {
        sendResponse({ success: false, reason: 'Already in blacklist' });
      }
    });
    return true;
  }
});

// Handle analytics batch processing
setInterval(() => {
  chrome.storage.local.get(['emotionAnalytics'], (result) => {
    const analytics = result.emotionAnalytics || [];
    
    if (analytics.length > 0) {
      // Batch process every 60 seconds
      console.log(`📊 Processing ${analytics.length} emotion records`);
      
      // Could send to backend here
      // For now, just log
    }
  });
}, 60000);
