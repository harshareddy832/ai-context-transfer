class APIClient {
  static async sendMessage(type, data = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        type,
        data
      });

      if (response && response.success) {
        return response.data;
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error) {
      console.error(`API call failed for ${type}:`, error);
      throw error;
    }
  }

  static async getSettings() {
    return await this.sendMessage('GET_SETTINGS');
  }

  static async updateSettings(settings) {
    return await this.sendMessage('UPDATE_SETTINGS', settings);
  }

  static async extractConversation() {
    return await this.sendMessage('EXTRACT_CONVERSATION');
  }

  static async summarizeConversation(conversation) {
    return await this.sendMessage('SUMMARIZE_CONVERSATION', conversation);
  }

  static async checkPlatform() {
    return await this.sendMessage('CHECK_PLATFORM');
  }

  static async testOllamaConnection(url, model) {
    try {
      const response = await fetch(`${url}/api/tags`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const modelExists = data.models?.some(m => m.name.includes(model));
      
      return {
        connected: true,
        models: data.models || [],
        modelExists,
        version: data.version || 'unknown'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        models: [],
        modelExists: false
      };
    }
  }

  static async testOpenAIConnection(apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        connected: true,
        models: data.data || [],
        organization: response.headers.get('openai-organization') || 'default'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        models: []
      };
    }
  }

  static async testAnthropicConnection(apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        connected: true,
        model: 'claude-3-haiku-20240307'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  static async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  static formatConversation(conversation, format = 'markdown') {
    if (!conversation || !conversation.messages) {
      return '';
    }

    const { messages, platform, extractedAt } = conversation;
    
    switch (format) {
      case 'markdown':
        return this.formatAsMarkdown(messages, platform, extractedAt);
      case 'plain':
        return this.formatAsPlainText(messages, platform, extractedAt);
      case 'json':
        return JSON.stringify(conversation, null, 2);
      case 'html':
        return this.formatAsHTML(messages, platform, extractedAt);
      default:
        return this.formatAsMarkdown(messages, platform, extractedAt);
    }
  }

  static formatAsMarkdown(messages, platform, extractedAt) {
    let output = `# Conversation Context (${platform})\n\n`;
    output += `*Extracted: ${new Date(extractedAt).toLocaleString()}*\n\n`;
    output += `---\n\n`;

    messages.forEach((msg, index) => {
      const role = msg.role === 'user' ? '**You**' : '**Assistant**';
      output += `${role}:\n${msg.content}\n\n`;
      
      if (index < messages.length - 1) {
        output += `---\n\n`;
      }
    });

    output += `\n*Generated by AI Context Transfer Extension*`;
    return output;
  }

  static formatAsPlainText(messages, platform, extractedAt) {
    let output = `Conversation Context (${platform})\n`;
    output += `Extracted: ${new Date(extractedAt).toLocaleString()}\n\n`;
    output += `${'='.repeat(50)}\n\n`;

    messages.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      output += `${role}: ${msg.content}\n\n`;
      
      if (index < messages.length - 1) {
        output += `${'-'.repeat(30)}\n\n`;
      }
    });

    output += `\nGenerated by AI Context Transfer Extension`;
    return output;
  }

  static formatAsHTML(messages, platform, extractedAt) {
    let output = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Conversation Context - ${platform}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #000;
      color: #fff;
    }
    .header { 
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    .message { 
      margin: 20px 0;
      padding: 15px;
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    .user { 
      background: rgba(255, 255, 255, 0.1);
      border-left: 4px solid #fff;
    }
    .assistant { 
      background: rgba(255, 255, 255, 0.05);
      border-left: 4px solid #666;
    }
    .role { 
      font-weight: bold;
      margin-bottom: 8px;
      opacity: 0.8;
    }
    .content { 
      white-space: pre-wrap;
    }
    .footer { 
      text-align: center;
      margin-top: 30px;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Conversation Context - ${platform}</h1>
    <p>Extracted: ${new Date(extractedAt).toLocaleString()}</p>
  </div>
`;

    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      output += `
  <div class="message ${msg.role}">
    <div class="role">${role}</div>
    <div class="content">${this.escapeHtml(msg.content)}</div>
  </div>`;
    });

    output += `
  <div class="footer">
    <p>Generated by AI Context Transfer Extension</p>
  </div>
</body>
</html>`;

    return output;
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static truncateContent(content, maxLength = 1000) {
    if (!content || content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength - 3);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }

  static validateApiKey(apiKey, provider) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key is required' };
    }

    const patterns = {
      openai: /^sk-[A-Za-z0-9]{48}$/,
      anthropic: /^sk-ant-[A-Za-z0-9\-_]{95}$/
    };

    if (provider === 'openai') {
      if (!patterns.openai.test(apiKey)) {
        return { valid: false, error: 'Invalid OpenAI API key format' };
      }
    } else if (provider === 'anthropic') {
      if (!patterns.anthropic.test(apiKey)) {
        return { valid: false, error: 'Invalid Anthropic API key format' };
      }
    }

    return { valid: true };
  }

  static async checkHealth() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'HEALTH_CHECK' });
      return response?.success || false;
    } catch (error) {
      return false;
    }
  }

  static formatError(error) {
    if (typeof error === 'string') {
      return error;
    }

    if (error.message) {
      return error.message;
    }

    return 'An unknown error occurred';
  }

  static async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  static async generatePDF(conversation, summary = null) {
    try {
      const htmlContent = this.formatAsHTML(conversation.messages, conversation.platform, conversation.extractedAt);
      
      // Create a new window to render the HTML for PDF generation
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait for content to load
      await new Promise(resolve => {
        printWindow.onload = resolve;
        if (printWindow.document.readyState === 'complete') resolve();
      });
      
      // Trigger print dialog which allows saving as PDF
      printWindow.print();
      
      return true;
    } catch (error) {
      console.error('PDF generation failed:', error);
      return false;
    }
  }

  static async downloadFile(content, filename, mimeType = 'text/plain') {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      return false;
    }
  }

  static async generateSmartSummary(conversation, targetFormat = 'markdown') {
    console.log('🚀 [API Client] Starting generateSmartSummary...');
    console.log('📊 [API Client] Input conversation:', {
      platform: conversation.platform,
      messageCount: conversation.messages?.length,
      targetFormat
    });
    
    try {
      // Get the conversation in the desired format
      const formatted = this.formatConversation(conversation, targetFormat);
      console.log('📝 [API Client] Formatted conversation length:', formatted.length);
      console.log('📝 [API Client] Formatted sample:', formatted.substring(0, 200) + '...');
      
      console.log('📡 [API Client] Sending SMART_SUMMARIZE message to background...');
      
      // Send to AI summarizer
      const response = await chrome.runtime.sendMessage({
        type: 'SMART_SUMMARIZE',
        data: {
          conversation,
          formatted,
          targetFormat
        }
      });
      
      console.log('📨 [API Client] Response from background:', {
        success: response?.success,
        hasData: !!response?.data,
        dataLength: response?.data?.length,
        error: response?.error
      });
      
      if (response && response.success) {
        console.log('✅ [API Client] Smart summary successful');
        console.log('📝 [API Client] Summary sample:', response.data.substring(0, 300) + '...');
        
        // Check if this looks like a summary or raw conversation
        const isActualSummary = this.validateSummary(response.data, formatted);
        console.log('🔍 [API Client] Is actual summary (not raw chat):', isActualSummary);
        
        return response.data;
      } else {
        throw new Error(response?.error || 'Smart summarization failed');
      }
    } catch (error) {
      console.error('❌ [API Client] Smart summarization failed:', error);
      // Fallback to basic formatting
      const fallback = this.formatConversation(conversation, targetFormat);
      console.log('⚠️ [API Client] Using fallback formatting');
      return fallback;
    }
  }

  static validateSummary(summary, originalFormatted) {
    // Check if the summary looks like an actual summary vs raw conversation
    const summaryWords = summary.toLowerCase();
    const originalWords = originalFormatted.toLowerCase();
    
    // Check for summary indicators
    const summaryIndicators = [
      'core objective', 'key topics', 'main goals', 'summary', 'progress made',
      'next steps', 'decisions', 'important points', 'context for continuation'
    ];
    
    const hasIndicators = summaryIndicators.some(indicator => 
      summaryWords.includes(indicator)
    );
    
    // Check if it's too similar to original (indicating it's raw conversation)
    const similarityRatio = this.calculateSimilarity(summary, originalFormatted);
    
    console.log('🔍 [API Client] Summary validation:', {
      hasIndicators,
      similarityRatio,
      summaryLength: summary.length,
      originalLength: originalFormatted.length
    });
    
    return hasIndicators && similarityRatio < 0.8; // Less than 80% similar to original
  }

  static calculateSimilarity(str1, str2) {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    return intersection.length / Math.max(words1.length, words2.length);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIClient;
}