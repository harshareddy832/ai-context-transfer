class ContentScriptManager {
  constructor() {
    this.platform = this.detectPlatform();
    this.rateLimitDetected = false;
    this.observer = null;
    this.transferButton = null;
    this.manualSummarizeButton = null;
    this.settings = {};
    this.init();
  }

  detectPlatform() {
    const url = window.location.href;
    const hostname = window.location.hostname;
    
    // More robust URL detection with additional patterns
    const chatgptPatterns = [
      'chat.openai.com',
      'chatgpt.com',
      'openai.com/chat',
      'beta.openai.com',
      'platform.openai.com'
    ];
    
    const claudePatterns = [
      'claude.ai',
      'console.anthropic.com',
      'beta.claude.ai',
      'app.claude.ai'
    ];
    
    // Check ChatGPT patterns
    if (chatgptPatterns.some(pattern => url.includes(pattern) || hostname.includes(pattern))) {
      return 'chatgpt';
    }
    
    // Check Claude patterns
    if (claudePatterns.some(pattern => url.includes(pattern) || hostname.includes(pattern))) {
      return 'claude';
    }
    
    // Additional fallback checks for common variations
    if (hostname.endsWith('openai.com') && (url.includes('chat') || url.includes('gpt'))) {
      return 'chatgpt';
    }
    
    if (hostname.endsWith('anthropic.com') && url.includes('claude')) {
      return 'claude';
    }
    
    // Log for debugging
    console.log('AI Context Transfer: Checking URL:', url);
    console.log('AI Context Transfer: Hostname:', hostname);
    
    return 'unknown';
  }

  async init() {
    if (this.platform === 'unknown') {
      console.log('AI Context Transfer: Unsupported platform');
      return;
    }

    await this.loadSettings();
    this.setupRateLimitDetection();
    this.setupMessageListener();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onPageReady());
    } else {
      this.onPageReady();
    }
  }

  onPageReady() {
    this.startObserving();
    this.showManualSummarizeButton();
    console.log(`AI Context Transfer: Initialized on ${this.platform}`);
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      this.settings = response.success ? response.data : {};
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = {};
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'GET_CONVERSATION':
          this.extractConversation()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

        case 'SHOW_TRANSFER_BUTTON':
          this.showTransferButton();
          sendResponse({ success: true });
          return true;

        case 'HIDE_TRANSFER_BUTTON':
          this.hideTransferButton();
          sendResponse({ success: true });
          return true;

        case 'TOGGLE_MANUAL_BUTTON':
          this.toggleManualSummarizeButton(message.data.show);
          sendResponse({ success: true });
          return true;

        case 'SETTINGS_UPDATED':
          this.loadSettings().then(() => {
            this.showManualSummarizeButton();
          });
          sendResponse({ success: true });
          return true;
      }
    });
  }

  setupRateLimitDetection() {
    const rateLimitIndicators = this.getRateLimitIndicators();
    
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkForRateLimit(node, rateLimitIndicators);
          }
        });
      });
    });
  }

  getRateLimitIndicators() {
    const indicators = {
      chatgpt: [
        'too many requests',
        'rate limit',
        'please try again later',
        'quota exceeded',
        'temporarily unavailable',
        'you have reached your',
        'usage limit'
      ],
      claude: [
        'rate limit',
        'too many messages',
        'please wait',
        'quota exceeded',
        'usage limit',
        'try again in',
        'temporarily unavailable'
      ]
    };

    return indicators[this.platform] || [];
  }

  checkForRateLimit(element, indicators) {
    if (this.rateLimitDetected) return;

    const text = element.textContent?.toLowerCase() || '';
    const hasRateLimitText = indicators.some(indicator => 
      text.includes(indicator.toLowerCase())
    );

    if (hasRateLimitText) {
      this.handleRateLimitDetected(element);
    }
  }

  async handleRateLimitDetected(element) {
    this.rateLimitDetected = true;
    console.log('AI Context Transfer: Rate limit detected');

    try {
      await chrome.runtime.sendMessage({
        type: 'RATE_LIMIT_DETECTED',
        data: {
          platform: this.platform,
          element: element.textContent,
          url: window.location.href,
          timestamp: Date.now()
        }
      });

      this.showTransferButton();
    } catch (error) {
      console.error('Failed to notify background script:', error);
    }
  }

  showTransferButton() {
    if (this.transferButton) return;

    this.transferButton = this.createTransferButton();
    this.insertTransferButton();
  }

  createTransferButton() {
    const button = document.createElement('div');
    button.id = 'ai-context-transfer-button';
    button.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        border: none;
        text-decoration: none;
        user-select: none;
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 25px rgba(0,0,0,0.2)'" 
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.15)'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Transfer Context
      </div>
    `;

    button.addEventListener('click', () => this.handleTransferClick());
    return button;
  }

  insertTransferButton() {
    if (!this.transferButton) return;

    const targetContainer = this.getButtonContainer();
    if (targetContainer) {
      targetContainer.appendChild(this.transferButton);
    } else {
      document.body.appendChild(this.transferButton);
    }
  }

  getButtonContainer() {
    switch (this.platform) {
      case 'chatgpt':
        return document.querySelector('main') || document.querySelector('#__next');
      case 'claude':
        return document.querySelector('[data-testid="claude-desktop"]') || document.querySelector('main');
      default:
        return null;
    }
  }

  hideTransferButton() {
    if (this.transferButton) {
      this.transferButton.remove();
      this.transferButton = null;
    }
  }

  showManualSummarizeButton() {
    if (!this.settings.showManualSummarizeButton) return;
    if (this.manualSummarizeButton) return;

    this.manualSummarizeButton = this.createManualSummarizeButton();
    this.insertManualSummarizeButton();
  }

  createManualSummarizeButton() {
    const button = document.createElement('div');
    button.id = 'ai-context-manual-summarize-button';
    button.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 12px;
        border-radius: 50%;
        cursor: pointer;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        transition: all 0.3s ease;
        border: none;
        text-decoration: none;
        user-select: none;
      " 
      onmouseover="this.style.transform='scale(1.1) translateY(-2px)'; this.style.boxShadow='0 6px 25px rgba(0,0,0,0.2)'; this.querySelector('.tooltip').style.opacity='1';" 
      onmouseout="this.style.transform='scale(1) translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.15)'; this.querySelector('.tooltip').style.opacity='0';"
      title="Summarize Chat">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C3.89,3 3,3.9 19,3Z"/>
        </svg>
        <div class="tooltip" style="
          position: absolute;
          right: 60px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        ">Summarize Chat</div>
      </div>
    `;

    button.addEventListener('click', () => this.handleManualSummarizeClick());
    return button;
  }

  insertManualSummarizeButton() {
    if (!this.manualSummarizeButton) return;
    document.body.appendChild(this.manualSummarizeButton);
  }

  hideManualSummarizeButton() {
    if (this.manualSummarizeButton) {
      this.manualSummarizeButton.remove();
      this.manualSummarizeButton = null;
    }
  }

  toggleManualSummarizeButton(show) {
    if (show) {
      this.showManualSummarizeButton();
    } else {
      this.hideManualSummarizeButton();
    }
  }

  async handleManualSummarizeClick() {
    try {
      this.showManualSummarizeLoadingState();
      
      const conversation = await this.extractConversation();
      
      if (!conversation.messages || conversation.messages.length === 0) {
        this.showError('No conversation found to summarize');
        return;
      }

      await chrome.runtime.sendMessage({
        type: 'MANUAL_SUMMARIZE',
        data: { conversation, platform: this.platform }
      });

      this.showSuccess('Conversation summarized! Check the extension popup.');
      
    } catch (error) {
      console.error('Manual summarize failed:', error);
      this.showError('Failed to summarize conversation');
    } finally {
      this.hideManualSummarizeLoadingState();
    }
  }

  showManualSummarizeLoadingState() {
    if (this.manualSummarizeButton) {
      const button = this.manualSummarizeButton.querySelector('div');
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="animation: spin 1s linear infinite;">
          <path d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"/>
        </svg>
      `;
      button.style.pointerEvents = 'none';
    }
  }

  hideManualSummarizeLoadingState() {
    if (this.manualSummarizeButton) {
      const button = this.manualSummarizeButton.querySelector('div');
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C3.89,3 3,3.9 19,3Z"/>
        </svg>
        <div class="tooltip" style="
          position: absolute;
          right: 60px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        ">Summarize Chat</div>
      `;
      button.style.pointerEvents = 'auto';
    }
  }

  showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      animation: slideInRight 0.3s ease;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);

    setTimeout(() => successDiv.remove(), 3000);
  }

  async handleTransferClick() {
    try {
      this.showLoadingState();
      
      const conversation = await this.extractConversation();
      
      chrome.runtime.sendMessage({
        type: 'OPEN_POPUP',
        data: { conversation, platform: this.platform }
      });

    } catch (error) {
      console.error('Transfer failed:', error);
      this.showError('Failed to extract conversation');
    } finally {
      this.hideLoadingState();
    }
  }

  showLoadingState() {
    if (this.transferButton) {
      const button = this.transferButton.querySelector('div');
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="animation: spin 1s linear infinite;">
          <path d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"/>
        </svg>
        Processing...
      `;
      button.style.pointerEvents = 'none';
    }
  }

  hideLoadingState() {
    if (this.transferButton) {
      const button = this.transferButton.querySelector('div');
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Transfer Context
      `;
      button.style.pointerEvents = 'auto';
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => errorDiv.remove(), 3000);
  }

  async extractConversation() {
    switch (this.platform) {
      case 'chatgpt':
        return this.extractChatGPTConversation();
      case 'claude':
        return this.extractClaudeConversation();
      default:
        throw new Error('Unsupported platform');
    }
  }

  extractChatGPTConversation() {
    const messages = [];
    
    const messageSelectors = [
      '[data-message-author-role]',
      '[data-testid^="conversation-turn"]',
      '.group.w-full'
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) break;
    }

    messageElements.forEach(el => {
      const role = this.determineChatGPTRole(el);
      const content = this.extractChatGPTContent(el);
      
      if (content && content.trim()) {
        messages.push({
          role,
          content: content.trim(),
          timestamp: Date.now()
        });
      }
    });

    return {
      platform: 'ChatGPT',
      messages,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      totalMessages: messages.length
    };
  }

  determineChatGPTRole(element) {
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr === 'user' ? 'user' : 'assistant';
    
    const hasUserIndicators = element.querySelector('[data-testid="user-message"]') ||
                             element.textContent.includes('You:') ||
                             element.classList.contains('user');
    
    return hasUserIndicators ? 'user' : 'assistant';
  }

  extractChatGPTContent(element) {
    const contentSelectors = [
      '.markdown',
      '[data-message-content]',
      '.whitespace-pre-wrap',
      '.prose'
    ];

    for (const selector of contentSelectors) {
      const contentEl = element.querySelector(selector);
      if (contentEl) return contentEl.innerText || contentEl.textContent;
    }

    return element.innerText || element.textContent;
  }

  extractClaudeConversation() {
    const messages = [];
    
    const messageSelectors = [
      '[data-is-streaming="false"]',
      '[data-testid*="turn"]',
      '.font-claude-message'
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) break;
    }

    messageElements.forEach(el => {
      const role = this.determineClaudeRole(el);
      const content = this.extractClaudeContent(el);
      
      if (content && content.trim()) {
        messages.push({
          role,
          content: content.trim(),
          timestamp: Date.now()
        });
      }
    });

    return {
      platform: 'Claude',
      messages,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      totalMessages: messages.length
    };
  }

  determineClaudeRole(element) {
    const hasHumanIndicators = element.querySelector('[data-testid="human-turn"]') ||
                              element.querySelector('.human') ||
                              element.textContent.includes('Human:');
    
    const hasAssistantIndicators = element.querySelector('[data-testid="assistant-turn"]') ||
                                  element.querySelector('.assistant') ||
                                  element.textContent.includes('Assistant:');

    if (hasHumanIndicators) return 'user';
    if (hasAssistantIndicators) return 'assistant';
    
    return 'assistant';
  }

  extractClaudeContent(element) {
    const unwantedSelectors = [
      '[data-testid="copy-button"]',
      '.copy-button',
      '.timestamp',
      '.metadata'
    ];

    const clone = element.cloneNode(true);
    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    return clone.innerText || clone.textContent;
  }

  startObserving() {
    if (this.observer) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

const addCSS = () => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes slideInRight {
      0% { transform: translateX(100%); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    
    #ai-context-transfer-button:hover {
      transform: translateY(-2px) !important;
    }
    
    #ai-context-manual-summarize-button:hover {
      transform: scale(1.1) translateY(-2px) !important;
    }
  `;
  document.head.appendChild(style);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    addCSS();
    new ContentScriptManager();
  });
} else {
  addCSS();
  new ContentScriptManager();
}