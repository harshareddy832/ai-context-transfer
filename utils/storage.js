class StorageManager {
  static async get(keys) {
    try {
      if (typeof keys === 'string') {
        const result = await chrome.storage.sync.get([keys]);
        return result[keys];
      }
      
      if (Array.isArray(keys)) {
        return await chrome.storage.sync.get(keys);
      }
      
      return await chrome.storage.sync.get(keys);
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }

  static async set(data) {
    try {
      await chrome.storage.sync.set(data);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  static async remove(keys) {
    try {
      await chrome.storage.sync.remove(keys);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  static async clear() {
    try {
      await chrome.storage.sync.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  static async getSettings() {
    const defaultSettings = {
      preferredLLM: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama2',
      openaiApiKey: '',
      anthropicApiKey: '',
      summaryLength: 'medium',
      autoDetectRateLimit: true,
      privacyMode: true,
      maxConversationLength: 50,
      enableNotifications: true,
      autoSummarize: false,
      showManualSummarizeButton: true
    };

    try {
      const stored = await this.get('settings');
      return { ...defaultSettings, ...stored };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return defaultSettings;
    }
  }

  static async updateSettings(newSettings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...newSettings };
      await this.set({ settings: updatedSettings });
      return updatedSettings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  static async saveConversation(conversation, options = {}) {
    try {
      const conversations = await this.get('conversations') || [];
      const conversationData = {
        id: Date.now().toString(),
        ...conversation,
        savedAt: new Date().toISOString(),
        ...options
      };

      conversations.unshift(conversationData);
      
      const maxHistory = (await this.getSettings()).maxConversationLength || 50;
      if (conversations.length > maxHistory) {
        conversations.splice(maxHistory);
      }

      await this.set({ conversations });
      return conversationData;
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  }

  static async getConversations(limit = 10) {
    try {
      const conversations = await this.get('conversations') || [];
      return conversations.slice(0, limit);
    } catch (error) {
      console.error('Failed to get conversations:', error);
      return [];
    }
  }

  static async deleteConversation(id) {
    try {
      const conversations = await this.get('conversations') || [];
      const filtered = conversations.filter(conv => conv.id !== id);
      await this.set({ conversations: filtered });
      return true;
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      return false;
    }
  }

  static async getUsageStats() {
    try {
      const stats = await this.get('usageStats') || {
        totalTransfers: 0,
        totalSummarizations: 0,
        preferredLLMUsage: {},
        lastUsed: null,
        platformUsage: {}
      };
      return stats;
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {};
    }
  }

  static async updateUsageStats(action, metadata = {}) {
    try {
      const stats = await this.getUsageStats();
      const now = new Date().toISOString();

      switch (action) {
        case 'transfer':
          stats.totalTransfers = (stats.totalTransfers || 0) + 1;
          if (metadata.platform) {
            stats.platformUsage[metadata.platform] = (stats.platformUsage[metadata.platform] || 0) + 1;
          }
          break;

        case 'summarize':
          stats.totalSummarizations = (stats.totalSummarizations || 0) + 1;
          if (metadata.llm) {
            stats.preferredLLMUsage[metadata.llm] = (stats.preferredLLMUsage[metadata.llm] || 0) + 1;
          }
          break;
      }

      stats.lastUsed = now;
      await this.set({ usageStats: stats });
      return stats;
    } catch (error) {
      console.error('Failed to update usage stats:', error);
      return null;
    }
  }

  static async exportData() {
    try {
      const data = await chrome.storage.sync.get();
      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        data
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  static async importData(importData) {
    try {
      if (!importData.data) {
        throw new Error('Invalid import data format');
      }

      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(importData.data);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  static addChangeListener(callback) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        callback(changes);
      }
    });
  }

  static async getBytesInUse() {
    try {
      return await chrome.storage.sync.getBytesInUse();
    } catch (error) {
      console.error('Failed to get bytes in use:', error);
      return 0;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}