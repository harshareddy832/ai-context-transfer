class PopupManager {
  constructor() {
    this.currentConversation = null;
    this.currentSummary = null;
    this.isEditing = false;
    this.isGeneratingSmartSummary = false;
    this.smartSummaryCache = null;
    this.init();
  }

  async init() {
    await this.checkPlatform();
    this.setupEventListeners();
    await this.checkForLatestSummary();
    this.showSection('action');
  }

  async checkPlatform() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const platform = this.detectPlatform(tab.url);
      
      document.getElementById('platformName').textContent = platform.name;
      document.getElementById('platformStatus').className = 
        `platform-status ${platform.supported ? 'connected' : 'disconnected'}`;
        
      const extractBtn = document.getElementById('extractBtn');
      if (!platform.supported) {
        extractBtn.disabled = true;
        extractBtn.textContent = 'Unsupported Platform';
      }
    } catch (error) {
      console.error('Failed to check platform:', error);
      this.showToast('Failed to detect platform', 'error');
    }
  }

  detectPlatform(url) {
    if (!url) return { name: 'Unknown', supported: false };
    
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
    if (chatgptPatterns.some(pattern => url.includes(pattern))) {
      return { name: 'ChatGPT', supported: true };
    }
    
    // Check Claude patterns
    if (claudePatterns.some(pattern => url.includes(pattern))) {
      return { name: 'Claude', supported: true };
    }
    
    // Additional fallback checks
    if (url.includes('openai.com') && (url.includes('chat') || url.includes('gpt'))) {
      return { name: 'ChatGPT', supported: true };
    }
    
    if (url.includes('anthropic.com') && url.includes('claude')) {
      return { name: 'Claude', supported: true };
    }
    
    return { name: 'Unsupported', supported: false };
  }

  async checkForLatestSummary() {
    try {
      const result = await chrome.storage.local.get(['latestSummary']);
      if (result.latestSummary) {
        const { conversation, summary, platform, processedAt } = result.latestSummary;
        
        const timeDiff = Date.now() - new Date(processedAt).getTime();
        const isRecent = timeDiff < 60000; // 1 minute
        
        if (isRecent) {
          this.currentConversation = conversation;
          this.currentSummary = summary;
          
          this.displayConversation();
          document.getElementById('summaryContent').textContent = summary;
          this.updateTransferPreview();
          
          this.showSection('conversation');
          this.showSection('summary');
          this.showSection('transfer');
          
          this.showToast('Recent manual summary loaded!', 'success');
        }
      }
    } catch (error) {
      console.error('Failed to check for latest summary:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    document.getElementById('extractBtn').addEventListener('click', () => {
      this.extractConversation();
    });

    document.getElementById('summarizeBtn').addEventListener('click', () => {
      this.summarizeConversation();
    });

    document.getElementById('historyBtn').addEventListener('click', () => {
      this.showHistory();
    });

    document.getElementById('regenerateBtn').addEventListener('click', () => {
      this.regenerateSummary();
    });

    document.getElementById('editBtn').addEventListener('click', () => {
      this.toggleEdit();
    });

    document.getElementById('copyBtn').addEventListener('click', () => {
      this.copyToClipboard();
    });

    document.getElementById('newTabBtn').addEventListener('click', () => {
      this.openInNewTab();
    });

    document.getElementById('pdfBtn').addEventListener('click', () => {
      this.generatePDF();
    });

    document.getElementById('downloadBtn').addEventListener('click', () => {
      this.downloadFile();
    });

    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
      this.clearHistory();
    });

    document.getElementById('formatSelect').addEventListener('change', () => {
      this.updateTransferPreview();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isEditing) {
        this.toggleEdit();
      }
    });
  }

  showSection(section) {
    const sections = ['conversation', 'summary', 'transfer', 'history'];
    sections.forEach(s => {
      document.getElementById(`${s}Section`).style.display = 
        s === section ? 'block' : 'none';
    });
  }

  showLoading(show = true, text = 'Processing...', showProgress = false) {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.querySelector('.loading-text');
    const progressContainer = document.getElementById('progressContainer');
    
    overlay.style.display = show ? 'flex' : 'none';
    loadingText.textContent = text;
    
    if (showProgress) {
      progressContainer.style.display = 'block';
      this.resetProgress();
    } else {
      progressContainer.style.display = 'none';
    }
  }

  updateProgress(percentage, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;
    
    if (text) {
      document.querySelector('.loading-text').textContent = text;
    }
  }

  resetProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const content = toast.querySelector('.toast-content');
    
    content.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  async extractConversation() {
    try {
      this.showLoading(true, 'Extracting conversation...');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const conversation = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_CONVERSATION'
      });

      if (!conversation || !conversation.data) {
        throw new Error('No conversation data received');
      }

      this.currentConversation = conversation.data;
      this.smartSummaryCache = null; // Clear cache for new conversation
      this.displayConversation();
      this.generateSummary();
      
    } catch (error) {
      console.error('Failed to extract conversation:', error);
      this.showToast('Failed to extract conversation', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async summarizeConversation() {
    try {
      this.showLoading(true, 'Extracting and summarizing conversation...');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const conversation = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_CONVERSATION'
      });

      if (!conversation || !conversation.data) {
        throw new Error('No conversation data received');
      }

      this.currentConversation = conversation.data;
      this.smartSummaryCache = null; // Clear cache for new conversation
      this.displayConversation();
      this.generateSummary();
      
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
      this.showToast('Failed to summarize conversation', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  displayConversation() {
    const preview = document.getElementById('conversationPreview');
    const messageCount = document.getElementById('messageCount');
    const messages = this.currentConversation.messages || [];
    
    messageCount.textContent = `${messages.length} messages`;
    
    if (messages.length === 0) {
      preview.innerHTML = this.getEmptyState('No messages found');
      return;
    }

    const maxPreview = 5;
    const displayMessages = messages.slice(-maxPreview);
    
    preview.innerHTML = displayMessages.map(msg => `
      <div class="message ${msg.role}">
        <div class="message-role">${msg.role === 'user' ? 'You' : 'Assistant'}</div>
        <div class="message-content">${this.truncateText(msg.content, 200)}</div>
      </div>
    `).join('');

    if (messages.length > maxPreview) {
      preview.innerHTML = `
        <div class="message-count">Showing last ${maxPreview} of ${messages.length} messages</div>
        ${preview.innerHTML}
      `;
    }

    this.showSection('conversation');
  }

  async generateSummary() {
    try {
      this.showLoading(true, 'Generating summary...');
      
      const summary = await APIClient.summarizeConversation(this.currentConversation);
      this.currentSummary = summary;
      
      document.getElementById('summaryContent').textContent = summary;
      this.showSection('summary');
      
      await this.updateTransferPreview();
      this.showSection('transfer');
      
    } catch (error) {
      console.error('Failed to generate summary:', error);
      this.showToast('Failed to generate summary', 'error');
      
      this.currentSummary = this.generateFallbackSummary();
      document.getElementById('summaryContent').textContent = this.currentSummary;
      this.showSection('summary');
    } finally {
      this.showLoading(false);
    }
  }

  generateFallbackSummary() {
    const messages = this.currentConversation.messages || [];
    const recentMessages = messages.slice(-5);
    
    let summary = `Conversation Summary (${this.currentConversation.platform})\n\n`;
    
    recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      const content = this.truncateText(msg.content, 150);
      summary += `${role}: ${content}\n\n`;
    });
    
    return summary;
  }

  async regenerateSummary() {
    if (!this.currentConversation) return;
    await this.generateSummary();
  }

  toggleEdit() {
    const content = document.getElementById('summaryContent');
    const editBtn = document.getElementById('editBtn');
    
    if (this.isEditing) {
      this.currentSummary = content.textContent;
      content.contentEditable = false;
      content.classList.remove('editable');
      editBtn.title = 'Edit Summary';
      this.isEditing = false;
      this.updateTransferPreview();
    } else {
      content.contentEditable = true;
      content.classList.add('editable');
      content.focus();
      editBtn.title = 'Save Changes';
      this.isEditing = true;
    }
  }

  async updateTransferPreview() {
    const format = document.getElementById('formatSelect').value;
    console.log('🔄 [Popup] updateTransferPreview called with format:', format);
    console.log('🔄 [Popup] Current state:', {
      isGeneratingSmartSummary: this.isGeneratingSmartSummary,
      hasCachedSummary: !!this.smartSummaryCache
    });
    
    try {
      if (format === 'smart-summary') {
        // Prevent multiple simultaneous smart summary generations
        if (this.isGeneratingSmartSummary) {
          console.log('⏳ [Popup] Smart summary already in progress, skipping...');
          return;
        }
        
        // Check if we have a cached smart summary
        if (this.smartSummaryCache) {
          console.log('💾 [Popup] Using cached smart summary');
          this.transferContent = this.smartSummaryCache;
          return;
        }
        
        this.isGeneratingSmartSummary = true;
        
        // Show progress bar for AI summarization
        this.showLoading(true, 'Initializing AI summarization...', true);
        console.log('🚀 [Popup] Starting smart summary generation...');
        console.log('📊 [Popup] Current conversation:', {
          platform: this.currentConversation?.platform,
          messageCount: this.currentConversation?.messages?.length
        });
        
        // Simulate progress steps
        this.updateProgress(10, 'Analyzing conversation...');
        await this.delay(300);
        
        this.updateProgress(25, 'Extracting key topics...');
        await this.delay(300);
        
        this.updateProgress(40, 'Generating summary with AI...');
        const targetFormat = 'markdown';
        
        console.log('🤖 [Popup] Calling APIClient.generateSmartSummary...');
        
        // Start the actual AI summarization
        const summaryPromise = APIClient.generateSmartSummary(this.currentConversation, targetFormat);
        
        // Continue progress simulation
        this.updateProgress(60, 'Processing AI response...');
        await this.delay(500);
        
        this.updateProgress(80, 'Formatting results...');
        
        // Wait for actual AI response
        this.transferContent = await summaryPromise;
        
        // Cache the smart summary
        this.smartSummaryCache = this.transferContent;
        
        console.log('📝 [Popup] Received transfer content:', {
          type: typeof this.transferContent,
          length: this.transferContent?.length,
          sample: this.transferContent?.substring(0, 200) + '...'
        });
        
        this.updateProgress(100, 'Summary completed!');
        await this.delay(300);
        
        console.log('✅ [Popup] Smart summary generation completed');
        this.showToast('Smart AI summary generated successfully!', 'success');
      } else {
        console.log('📄 [Popup] Using standard formatting for:', format);
        this.transferContent = APIClient.formatConversation(this.currentConversation, format);
        console.log('📝 [Popup] Standard format content length:', this.transferContent?.length);
      }
    } catch (error) {
      console.error('❌ [Popup] Failed to update transfer preview:', error);
      this.transferContent = APIClient.formatConversation(this.currentConversation, 'markdown');
      this.showToast(`Failed to generate smart summary: ${error.message}`, 'error');
    } finally {
      this.isGeneratingSmartSummary = false;
      this.showLoading(false);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async copyToClipboard() {
    try {
      console.log('📋 [Popup] Copy to clipboard called');
      console.log('📝 [Popup] Content being copied:', {
        type: typeof this.transferContent,
        length: this.transferContent?.length,
        sample: this.transferContent?.substring(0, 300) + '...',
        isMarkdown: this.transferContent?.includes('###'),
        hasSummaryKeywords: ['core objective', 'key topics', 'progress'].some(keyword => 
          this.transferContent?.toLowerCase().includes(keyword)
        )
      });
      
      const success = await APIClient.copyToClipboard(this.transferContent);
      if (success) {
        this.showToast('Copied to clipboard!', 'success');
        await this.saveToHistory();
      } else {
        this.showToast('Failed to copy to clipboard', 'error');
      }
    } catch (error) {
      console.error('❌ [Popup] Failed to copy:', error);
      this.showToast('Failed to copy to clipboard', 'error');
    }
  }

  async openInNewTab() {
    try {
      const format = document.getElementById('formatSelect').value;
      const mimeType = format === 'html' ? 'text/html' : 'text/plain';
      const blob = new Blob([this.transferContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      await chrome.tabs.create({ url });
      this.showToast('Opened in new tab', 'success');
      await this.saveToHistory();
    } catch (error) {
      console.error('Failed to open in new tab:', error);
      this.showToast('Failed to open in new tab', 'error');
    }
  }

  async generatePDF() {
    try {
      const success = await APIClient.generatePDF(this.currentConversation, this.currentSummary);
      if (success) {
        this.showToast('PDF generation started', 'success');
        await this.saveToHistory();
      } else {
        this.showToast('Failed to generate PDF', 'error');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      this.showToast('Failed to generate PDF', 'error');
    }
  }

  async downloadFile() {
    try {
      const format = document.getElementById('formatSelect').value;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const platform = this.currentConversation.platform || 'Unknown';
      
      let filename, mimeType;
      
      switch (format) {
        case 'smart-summary':
        case 'markdown':
          filename = `${platform}_conversation_${timestamp}.md`;
          mimeType = 'text/markdown';
          break;
        case 'plain':
          filename = `${platform}_conversation_${timestamp}.txt`;
          mimeType = 'text/plain';
          break;
        default:
          filename = `${platform}_conversation_${timestamp}.txt`;
          mimeType = 'text/plain';
      }
      
      const success = await APIClient.downloadFile(this.transferContent, filename, mimeType);
      if (success) {
        this.showToast('File downloaded successfully', 'success');
        await this.saveToHistory();
      } else {
        this.showToast('Failed to download file', 'error');
      }
    } catch (error) {
      console.error('Failed to download file:', error);
      this.showToast('Failed to download file', 'error');
    }
  }

  async saveToHistory() {
    try {
      await StorageManager.saveConversation(this.currentConversation, {
        summary: this.currentSummary,
        transferredAt: new Date().toISOString()
      });
      
      await StorageManager.updateUsageStats('transfer', {
        platform: this.currentConversation.platform
      });
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  }

  async showHistory() {
    try {
      const conversations = await StorageManager.getConversations();
      const historyList = document.getElementById('historyList');
      
      if (conversations.length === 0) {
        historyList.innerHTML = this.getEmptyState('No transfer history');
        this.showSection('history');
        return;
      }

      historyList.innerHTML = conversations.map(conv => `
        <div class="history-item" data-id="${conv.id}">
          <div class="history-item-header">
            <span class="history-item-platform">${conv.platform}</span>
            <span class="history-item-date">${this.formatDate(conv.savedAt)}</span>
          </div>
          <div class="history-item-preview">
            ${this.truncateText(conv.summary || conv.messages?.[0]?.content || 'No content', 100)}
          </div>
        </div>
      `).join('');

      historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item) {
          this.loadHistoryItem(item.dataset.id);
        }
      });

      this.showSection('history');
    } catch (error) {
      console.error('Failed to load history:', error);
      this.showToast('Failed to load history', 'error');
    }
  }

  async loadHistoryItem(id) {
    try {
      const conversations = await StorageManager.getConversations();
      const conversation = conversations.find(c => c.id === id);
      
      if (!conversation) {
        this.showToast('Conversation not found', 'error');
        return;
      }

      this.currentConversation = conversation;
      this.currentSummary = conversation.summary;
      
      this.displayConversation();
      document.getElementById('summaryContent').textContent = this.currentSummary;
      this.updateTransferPreview();
      
      this.showSection('conversation');
    } catch (error) {
      console.error('Failed to load history item:', error);
      this.showToast('Failed to load conversation', 'error');
    }
  }

  async clearHistory() {
    if (!confirm('Are you sure you want to clear all transfer history?')) {
      return;
    }

    try {
      await StorageManager.set({ conversations: [] });
      this.showToast('History cleared', 'success');
      this.showHistory();
    } catch (error) {
      console.error('Failed to clear history:', error);
      this.showToast('Failed to clear history', 'error');
    }
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  getEmptyState(message) {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <h3>No Data</h3>
        <p>${message}</p>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});