class OptionsManager {
  constructor() {
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    this.loadStats();
  }

  async loadSettings() {
    try {
      this.settings = await StorageManager.getSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showToast('Failed to load settings', 'error');
    }
  }

  setupEventListeners() {
    document.getElementById('preferredLLM').addEventListener('change', (e) => {
      this.settings.preferredLLM = e.target.value;
      this.updateLLMSections();
    });

    document.getElementById('ollamaUrl').addEventListener('input', (e) => {
      this.settings.ollamaUrl = e.target.value;
    });

    document.getElementById('ollamaModel').addEventListener('input', (e) => {
      this.settings.ollamaModel = e.target.value;
    });

    document.getElementById('openaiApiKey').addEventListener('input', (e) => {
      this.settings.openaiApiKey = e.target.value;
    });

    document.getElementById('anthropicApiKey').addEventListener('input', (e) => {
      this.settings.anthropicApiKey = e.target.value;
    });

    document.getElementById('summaryLength').addEventListener('change', (e) => {
      this.settings.summaryLength = e.target.value;
    });

    document.getElementById('autoSummarize').addEventListener('change', (e) => {
      this.settings.autoSummarize = e.target.checked;
    });

    document.getElementById('autoDetectRateLimit').addEventListener('change', (e) => {
      this.settings.autoDetectRateLimit = e.target.checked;
    });

    document.getElementById('enableNotifications').addEventListener('change', (e) => {
      this.settings.enableNotifications = e.target.checked;
    });

    document.getElementById('privacyMode').addEventListener('change', (e) => {
      this.settings.privacyMode = e.target.checked;
    });

    document.getElementById('showManualSummarizeButton').addEventListener('change', (e) => {
      this.settings.showManualSummarizeButton = e.target.checked;
      this.notifyContentScripts();
    });

    document.getElementById('maxConversationLength').addEventListener('input', (e) => {
      this.settings.maxConversationLength = parseInt(e.target.value);
    });

    document.getElementById('testOllama').addEventListener('click', () => {
      this.testConnection('ollama');
    });

    document.getElementById('testOpenAI').addEventListener('click', () => {
      this.testConnection('openai');
    });

    document.getElementById('testAnthropic').addEventListener('click', () => {
      this.testConnection('anthropic');
    });

    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetSettings();
    });

    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('importData').addEventListener('click', () => {
      this.importData();
    });

    document.getElementById('clearData').addEventListener('click', () => {
      this.clearData();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileImport(e.target.files[0]);
    });
  }

  updateUI() {
    document.getElementById('preferredLLM').value = this.settings.preferredLLM || 'ollama';
    document.getElementById('ollamaUrl').value = this.settings.ollamaUrl || 'http://localhost:11434';
    document.getElementById('ollamaModel').value = this.settings.ollamaModel || 'llama2';
    document.getElementById('openaiApiKey').value = this.settings.openaiApiKey || '';
    document.getElementById('anthropicApiKey').value = this.settings.anthropicApiKey || '';
    document.getElementById('summaryLength').value = this.settings.summaryLength || 'medium';
    document.getElementById('autoSummarize').checked = this.settings.autoSummarize || false;
    document.getElementById('autoDetectRateLimit').checked = this.settings.autoDetectRateLimit !== false;
    document.getElementById('enableNotifications').checked = this.settings.enableNotifications !== false;
    document.getElementById('privacyMode').checked = this.settings.privacyMode !== false;
    document.getElementById('showManualSummarizeButton').checked = this.settings.showManualSummarizeButton !== false;
    document.getElementById('maxConversationLength').value = this.settings.maxConversationLength || 50;

    this.updateLLMSections();
  }

  updateLLMSections() {
    const preferredLLM = this.settings.preferredLLM || 'ollama';
    
    document.getElementById('ollamaSettings').classList.toggle('hidden', preferredLLM !== 'ollama');
    document.getElementById('openaiSettings').classList.toggle('hidden', preferredLLM !== 'openai');
    document.getElementById('anthropicSettings').classList.toggle('hidden', preferredLLM !== 'anthropic');
  }

  async testConnection(provider) {
    const button = document.getElementById(`test${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
    const status = document.getElementById(`${provider}Status`);
    
    button.disabled = true;
    button.querySelector('svg').classList.add('loading');
    status.textContent = 'Testing connection...';
    status.className = 'connection-status testing';

    try {
      let result;
      
      switch (provider) {
        case 'ollama':
          result = await APIClient.testOllamaConnection(
            this.settings.ollamaUrl,
            this.settings.ollamaModel
          );
          break;
        case 'openai':
          result = await APIClient.testOpenAIConnection(this.settings.openaiApiKey);
          break;
        case 'anthropic':
          result = await APIClient.testAnthropicConnection(this.settings.anthropicApiKey);
          break;
      }

      if (result.connected) {
        status.textContent = this.getSuccessMessage(provider, result);
        status.className = 'connection-status success';
      } else {
        status.textContent = `Connection failed: ${result.error}`;
        status.className = 'connection-status error';
      }
    } catch (error) {
      status.textContent = `Connection failed: ${error.message}`;
      status.className = 'connection-status error';
    } finally {
      button.disabled = false;
      button.querySelector('svg').classList.remove('loading');
    }
  }

  getSuccessMessage(provider, result) {
    switch (provider) {
      case 'ollama':
        return `Connected! ${result.models.length} models available. ${result.modelExists ? 'Model found.' : 'Model not found.'}`;
      case 'openai':
        return `Connected! ${result.models.length} models available.`;
      case 'anthropic':
        return `Connected! Model: ${result.model}`;
      default:
        return 'Connected!';
    }
  }

  async saveSettings() {
    try {
      const saveButton = document.getElementById('saveSettings');
      const saveStatus = document.getElementById('saveStatus');
      
      saveButton.disabled = true;
      saveStatus.textContent = 'Saving...';
      saveStatus.className = 'save-status';

      await StorageManager.updateSettings(this.settings);
      
      saveStatus.textContent = 'Settings saved successfully!';
      saveStatus.className = 'save-status success';
      
      this.showToast('Settings saved successfully!', 'success');
      this.notifyContentScripts();
      
      setTimeout(() => {
        saveStatus.textContent = '';
        saveStatus.className = 'save-status';
      }, 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      
      const saveStatus = document.getElementById('saveStatus');
      saveStatus.textContent = 'Failed to save settings';
      saveStatus.className = 'save-status error';
      
      this.showToast('Failed to save settings', 'error');
    } finally {
      document.getElementById('saveSettings').disabled = false;
    }
  }

  async resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      await StorageManager.remove('settings');
      this.settings = await StorageManager.getSettings();
      this.updateUI();
      this.showToast('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showToast('Failed to reset settings', 'error');
    }
  }

  async loadStats() {
    try {
      const stats = await StorageManager.getUsageStats();
      const bytesUsed = await StorageManager.getBytesInUse();
      
      document.getElementById('totalTransfers').textContent = stats.totalTransfers || 0;
      document.getElementById('storageUsed').textContent = this.formatBytes(bytesUsed);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async exportData() {
    try {
      const data = await StorageManager.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-context-transfer-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showToast('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export data:', error);
      this.showToast('Failed to export data', 'error');
    }
  }

  importData() {
    document.getElementById('fileInput').click();
  }

  async handleFileImport(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.data || !data.version) {
        throw new Error('Invalid backup file format');
      }

      if (!confirm('This will replace all current data. Are you sure?')) {
        return;
      }

      await StorageManager.importData(data);
      this.settings = await StorageManager.getSettings();
      this.updateUI();
      this.loadStats();
      
      this.showToast('Data imported successfully!', 'success');
    } catch (error) {
      console.error('Failed to import data:', error);
      this.showToast('Failed to import data: ' + error.message, 'error');
    }
  }

  async clearData() {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      return;
    }

    const doubleConfirm = prompt('Type "DELETE" to confirm:');
    if (doubleConfirm !== 'DELETE') {
      return;
    }

    try {
      await StorageManager.clear();
      this.settings = await StorageManager.getSettings();
      this.updateUI();
      this.loadStats();
      
      this.showToast('All data cleared successfully!', 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showToast('Failed to clear data', 'error');
    }
  }

  async notifyContentScripts() {
    try {
      const tabs = await chrome.tabs.query({
        url: ['https://chat.openai.com/*', 'https://claude.ai/*']
      });
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          data: this.settings
        }).catch(() => {
          // Ignore errors for tabs that might not have content script loaded
        });
      }
    } catch (error) {
      console.error('Failed to notify content scripts:', error);
    }
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const content = toast.querySelector('.toast-content');
    
    content.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 5000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});