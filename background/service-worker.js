class BackgroundService {
  constructor() {
    this.setupListeners();
    this.rateLimitDetected = false;
  }

  setupListeners() {
    chrome.runtime.onInstalled.addListener(() => {
      this.initializeExtension();
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.isSupportedPlatform(tab.url)) {
        this.injectContentScript(tabId);
      }
    });
  }

  async initializeExtension() {
    const defaultSettings = {
      preferredLLM: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama2',
      openaiApiKey: '',
      anthropicApiKey: '',
      summaryLength: 'medium',
      autoDetectRateLimit: true,
      privacyMode: true
    };

    try {
      const existing = await chrome.storage.sync.get(['settings']);
      if (!existing.settings) {
        await chrome.storage.sync.set({ settings: defaultSettings });
      }
    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  }

  isSupportedPlatform(url) {
    if (!url) return false;
    
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
    
    return chatgptPatterns.some(pattern => url.includes(pattern)) ||
           claudePatterns.some(pattern => url.includes(pattern)) ||
           (url.includes('openai.com') && (url.includes('chat') || url.includes('gpt'))) ||
           (url.includes('anthropic.com') && url.includes('claude'));
  }

  getPlatformType(url) {
    if (!url) return 'unknown';
    
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
    
    if (chatgptPatterns.some(pattern => url.includes(pattern)) ||
        (url.includes('openai.com') && (url.includes('chat') || url.includes('gpt')))) {
      return 'chatgpt';
    }
    
    if (claudePatterns.some(pattern => url.includes(pattern)) ||
        (url.includes('anthropic.com') && url.includes('claude'))) {
      return 'claude';
    }
    
    return 'unknown';
  }

  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-script.js']
      });
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'RATE_LIMIT_DETECTED':
          await this.handleRateLimitDetected(message.data, sender.tab);
          sendResponse({ success: true });
          break;

        case 'EXTRACT_CONVERSATION':
          const conversation = await this.extractConversation(sender.tab);
          sendResponse({ success: true, data: conversation });
          break;

        case 'SUMMARIZE_CONVERSATION':
          const summary = await this.summarizeConversation(message.data);
          sendResponse({ success: true, data: summary });
          break;

        case 'GET_SETTINGS':
          const settings = await this.getSettings();
          sendResponse({ success: true, data: settings });
          break;

        case 'UPDATE_SETTINGS':
          await this.updateSettings(message.data);
          sendResponse({ success: true });
          break;

        case 'CHECK_PLATFORM':
          const platform = this.getPlatformType(sender.tab?.url);
          sendResponse({ success: true, data: { platform } });
          break;

        case 'MANUAL_SUMMARIZE':
          const manualSummary = await this.handleManualSummarization(message.data, sender.tab);
          sendResponse({ success: true, data: manualSummary });
          break;

        case 'SMART_SUMMARIZE':
          const smartSummary = await this.handleSmartSummarization(message.data);
          sendResponse({ success: true, data: smartSummary });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleRateLimitDetected(data, tab) {
    this.rateLimitDetected = true;
    
    await chrome.action.setBadgeText({
      text: '!',
      tabId: tab.id
    });

    await chrome.action.setBadgeBackgroundColor({
      color: '#FF4444',
      tabId: tab.id
    });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Rate Limit Detected',
      message: 'Click the extension to transfer your conversation context.'
    });
  }

  async handleManualSummarization(data, tab) {
    try {
      const { conversation, platform } = data;
      
      const summary = await this.summarizeConversation(conversation);
      
      await chrome.storage.local.set({
        latestSummary: {
          conversation,
          summary,
          platform,
          processedAt: new Date().toISOString()
        }
      });

      await chrome.action.setBadgeText({
        text: '✓',
        tabId: tab.id
      });

      await chrome.action.setBadgeBackgroundColor({
        color: '#10B981',
        tabId: tab.id
      });

      setTimeout(() => {
        chrome.action.setBadgeText({
          text: '',
          tabId: tab.id
        });
      }, 3000);

      return { summary, conversation, platform };
    } catch (error) {
      console.error('Manual summarization failed:', error);
      throw error;
    }
  }

  async handleSmartSummarization(data) {
    try {
      const { conversation, formatted, targetFormat } = data;
      const settings = await this.getSettings();
      
      console.log('🔍 Smart summarization settings:', {
        preferredLLM: settings.preferredLLM,
        ollamaUrl: settings.ollamaUrl,
        ollamaModel: settings.ollamaModel,
        hasOpenAI: !!settings.openaiApiKey,
        hasAnthropic: !!settings.anthropicApiKey
      });
      
      // Create a smart summary prompt that focuses on the format
      const prompt = this.buildSmartSummaryPrompt(conversation, formatted, targetFormat);
      console.log('📝 Generated smart summary prompt:', prompt.substring(0, 200) + '...');
      
      let summary;
      
      // Try to use AI summarization
      try {
        if (settings.preferredLLM === 'ollama') {
          console.log('🚀 Using Ollama for smart summarization');
          summary = await this.summarizeWithOllamaPrompt(prompt, settings);
          console.log('✅ Ollama summarization successful');
        } else if (settings.preferredLLM === 'openai' && settings.openaiApiKey) {
          console.log('🚀 Using OpenAI for smart summarization');
          summary = await this.summarizeWithOpenAIPrompt(prompt, settings);
          console.log('✅ OpenAI summarization successful');
        } else if (settings.preferredLLM === 'anthropic' && settings.anthropicApiKey) {
          console.log('🚀 Using Anthropic for smart summarization');
          summary = await this.summarizeWithAnthropicPrompt(prompt, settings);
          console.log('✅ Anthropic summarization successful');
        } else {
          console.log('❌ No AI provider configured or available');
          throw new Error('No AI provider configured');
        }
      } catch (error) {
        console.error('❌ AI summarization failed, using enhanced fallback:', error);
        summary = this.enhancedFallbackSummary(conversation, targetFormat);
      }
      
      return summary;
    } catch (error) {
      console.error('Smart summarization failed:', error);
      throw error;
    }
  }

  async extractConversation(tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: this.getConversationExtractor(this.getPlatformType(tab.url))
      });

      return results[0]?.result || null;
    } catch (error) {
      console.error('Failed to extract conversation:', error);
      throw new Error('Could not extract conversation from page');
    }
  }

  getConversationExtractor(platform) {
    switch (platform) {
      case 'chatgpt':
        return function() {
          const messages = [];
          const messageElements = document.querySelectorAll('[data-message-author-role]');
          
          messageElements.forEach(el => {
            const role = el.getAttribute('data-message-author-role');
            const content = el.querySelector('.markdown')?.innerText || 
                           el.querySelector('[data-message-content]')?.innerText || 
                           el.innerText;
            
            if (content && content.trim()) {
              messages.push({
                role: role === 'user' ? 'user' : 'assistant',
                content: content.trim(),
                timestamp: Date.now()
              });
            }
          });

          return {
            platform: 'ChatGPT',
            messages,
            url: window.location.href,
            extractedAt: new Date().toISOString()
          };
        };

      case 'claude':
        return function() {
          const messages = [];
          const messageElements = document.querySelectorAll('[data-is-streaming="false"]');
          
          messageElements.forEach(el => {
            const isHuman = el.querySelector('[data-testid="human-turn"]');
            const isAssistant = el.querySelector('[data-testid="assistant-turn"]');
            
            if (isHuman || isAssistant) {
              const content = el.innerText || el.textContent;
              if (content && content.trim()) {
                messages.push({
                  role: isHuman ? 'user' : 'assistant',
                  content: content.trim(),
                  timestamp: Date.now()
                });
              }
            }
          });

          return {
            platform: 'Claude',
            messages,
            url: window.location.href,
            extractedAt: new Date().toISOString()
          };
        };

      default:
        return function() {
          return { platform: 'Unknown', messages: [], error: 'Unsupported platform' };
        };
    }
  }

  async summarizeConversation(conversation) {
    const settings = await this.getSettings();
    
    try {
      if (settings.preferredLLM === 'ollama') {
        return await this.summarizeWithOllama(conversation, settings);
      } else if (settings.preferredLLM === 'openai' && settings.openaiApiKey) {
        return await this.summarizeWithOpenAI(conversation, settings);
      } else if (settings.preferredLLM === 'anthropic' && settings.anthropicApiKey) {
        return await this.summarizeWithAnthropic(conversation, settings);
      } else {
        return await this.fallbackSummarization(conversation);
      }
    } catch (error) {
      console.error('Summarization failed:', error);
      return await this.fallbackSummarization(conversation);
    }
  }

  async summarizeWithOllama(conversation, settings) {
    const prompt = this.buildSummaryPrompt(conversation, settings.summaryLength);
    return await this.summarizeWithOllamaPrompt(prompt, settings);
  }

  async summarizeWithOllamaPrompt(prompt, settings) {
    console.log('🔗 Attempting Ollama connection:', {
      url: settings.ollamaUrl,
      model: settings.ollamaModel,
      promptLength: prompt.length
    });
    
    console.log('📝 Prompt being sent to Ollama:', prompt.substring(0, 500) + '...');
    
    const response = await fetch(`${settings.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.ollamaModel,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      console.error('❌ Ollama API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Ollama response received:', {
      hasResponse: !!data.response,
      responseLength: data.response?.length,
      responseSample: data.response?.substring(0, 200) + '...'
    });
    
    if (!data.response) {
      throw new Error('Ollama returned empty response');
    }
    
    return data.response;
  }

  async summarizeWithOpenAI(conversation, settings) {
    const prompt = this.buildSummaryPrompt(conversation, settings.summaryLength);
    return await this.summarizeWithOpenAIPrompt(prompt, settings);
  }

  async summarizeWithOpenAIPrompt(prompt, settings) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.getMaxTokens(settings.summaryLength)
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async summarizeWithAnthropic(conversation, settings) {
    const prompt = this.buildSummaryPrompt(conversation, settings.summaryLength);
    return await this.summarizeWithAnthropicPrompt(prompt, settings);
  }

  async summarizeWithAnthropicPrompt(prompt, settings) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: this.getMaxTokens(settings.summaryLength),
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async fallbackSummarization(conversation) {
    const messages = conversation.messages || [];
    const recentMessages = messages.slice(-10);
    
    let summary = `Conversation Context Summary (${conversation.platform}):\n\n`;
    
    recentMessages.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'Human' : 'Assistant';
      const content = msg.content.length > 200 ? 
        msg.content.substring(0, 200) + '...' : 
        msg.content;
      summary += `${role}: ${content}\n\n`;
    });

    summary += `\n[Generated by AI Context Transfer Extension - ${new Date().toLocaleString()}]`;
    return summary;
  }

  buildSummaryPrompt(conversation, length) {
    const messages = conversation.messages || [];
    const conversationText = messages.map(msg => 
      `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');

    const lengthInstructions = {
      'short': 'in 2-3 sentences',
      'medium': 'in 1-2 paragraphs',
      'long': 'in 3-4 paragraphs with key details'
    };

    return `Please summarize this conversation ${lengthInstructions[length] || lengthInstructions.medium}. Focus on the main topics, key questions asked, and important information shared. Make it suitable for continuing the conversation in a new chat session.

Conversation:
${conversationText}

Summary:`;
  }

  buildSmartSummaryPrompt(conversation, formatted, targetFormat) {
    const messages = conversation.messages || [];
    const messageCount = messages.length;
    const platform = conversation.platform || 'AI Assistant';
    
    // Extract conversation context
    const conversationText = messages.map(msg => 
      `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');
    
    // Determine dynamic summary length based on conversation complexity
    let summaryLength = 'medium';
    let structureDepth = 'basic';
    
    if (messageCount <= 3) {
      summaryLength = 'concise';
      structureDepth = 'basic';
    } else if (messageCount <= 8) {
      summaryLength = 'balanced';
      structureDepth = 'detailed';
    } else {
      summaryLength = 'comprehensive';
      structureDepth = 'extensive';
    }
    
    return `You are an expert conversation analyst tasked with creating a high-quality, structured summary of a conversation between a human and an AI assistant (${platform}). This summary will be used to continue the conversation in a new session, so it must capture all essential context, decisions, and progress made.

## ANALYSIS TASK:
Create a ${summaryLength} summary that extracts the core essence and actionable insights from this conversation.

## CONVERSATION TO ANALYZE:
${conversationText}

## REQUIRED STRUCTURE:
Format your response as ${targetFormat} with these sections:

### 🎯 **Core Objective**
- What was the human trying to accomplish?
- What problem were they solving?

### 📋 **Key Topics & Decisions**
- Main subjects discussed
- Important decisions made
- Technical specifications or requirements mentioned

### 🔍 **Current Progress**
- What has been completed or resolved
- What solutions were provided
- Code, steps, or instructions given

### ⚠️ **Open Questions & Next Steps**
- Unresolved issues or pending questions
- Suggested next actions
- Areas that need further discussion

### 🧠 **Context for Continuation**
- Important background information
- User preferences or constraints mentioned
- Relevant details for future interactions

## PROMPT ENGINEERING GUIDELINES:
1. **Be Precise**: Extract only essential, actionable information
2. **Be Contextual**: Focus on information needed to continue the conversation
3. **Be Structured**: Use clear sections and bullet points
4. **Be Concise**: ${summaryLength === 'concise' ? 'Keep it brief but complete' : summaryLength === 'balanced' ? 'Balance detail with brevity' : 'Provide comprehensive detail while staying organized'}
5. **Be Actionable**: Include concrete next steps or follow-up items

## CONVERSATION METADATA:
- Messages: ${messageCount}
- Platform: ${platform}
- Summary Type: Smart AI Analysis

Generate a professional, structured summary that captures the essence of this conversation:`;
  }

  enhancedFallbackSummary(conversation, targetFormat) {
    const messages = conversation.messages || [];
    const platform = conversation.platform || 'Unknown';
    
    // Dynamic summary based on conversation length
    const messageCount = messages.length;
    let summaryDepth;
    
    if (messageCount <= 5) {
      summaryDepth = 'brief';
    } else if (messageCount <= 15) {
      summaryDepth = 'medium';
    } else {
      summaryDepth = 'detailed';
    }
    
    let summary = targetFormat === 'markdown' ? 
      `# Conversation Summary - ${platform}\n\n` : 
      `Conversation Summary - ${platform}\n\n`;
    
    // Extract key topics and themes
    const topics = this.extractTopics(messages);
    const keyExchanges = this.extractKeyExchanges(messages, summaryDepth);
    
    if (targetFormat === 'markdown') {
      summary += `## Key Topics\n`;
      topics.forEach(topic => {
        summary += `- ${topic}\n`;
      });
      summary += `\n## Key Exchanges\n`;
      keyExchanges.forEach(exchange => {
        summary += `### ${exchange.topic}\n`;
        summary += `**You**: ${exchange.userMessage}\n\n`;
        summary += `**Assistant**: ${exchange.assistantMessage}\n\n`;
      });
    } else {
      summary += `Key Topics:\n`;
      topics.forEach(topic => {
        summary += `• ${topic}\n`;
      });
      summary += `\nKey Exchanges:\n`;
      keyExchanges.forEach(exchange => {
        summary += `\n${exchange.topic}:\n`;
        summary += `You: ${exchange.userMessage}\n`;
        summary += `Assistant: ${exchange.assistantMessage}\n`;
      });
    }
    
    return summary;
  }

  extractTopics(messages) {
    const topics = new Set();
    const keywords = ['about', 'how', 'what', 'why', 'when', 'where', 'help', 'explain', 'create', 'build', 'make'];
    
    messages.forEach(msg => {
      if (msg.role === 'user') {
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach((word, index) => {
          if (keywords.includes(word) && index < words.length - 1) {
            const topic = words.slice(index, Math.min(index + 4, words.length)).join(' ');
            if (topic.length > 10) {
              topics.add(topic);
            }
          }
        });
      }
    });
    
    return Array.from(topics).slice(0, 5);
  }

  extractKeyExchanges(messages, depth) {
    const exchanges = [];
    const maxExchanges = depth === 'brief' ? 2 : depth === 'medium' ? 4 : 6;
    
    for (let i = 0; i < messages.length - 1; i++) {
      const userMsg = messages[i];
      const assistantMsg = messages[i + 1];
      
      if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
        const topic = userMsg.content.split(/[.!?]/)[0].substring(0, 50) + '...';
        exchanges.push({
          topic,
          userMessage: userMsg.content.substring(0, 150) + (userMsg.content.length > 150 ? '...' : ''),
          assistantMessage: assistantMsg.content.substring(0, 200) + (assistantMsg.content.length > 200 ? '...' : '')
        });
      }
    }
    
    return exchanges.slice(-maxExchanges);
  }

  getMaxTokens(length) {
    const tokenLimits = {
      'short': 150,
      'medium': 300,
      'long': 500
    };
    return tokenLimits[length] || tokenLimits.medium;
  }

  async getSettings() {
    try {
      const result = await chrome.storage.sync.get(['settings']);
      return result.settings || {};
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  async updateSettings(newSettings) {
    try {
      await chrome.storage.sync.set({ settings: newSettings });
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }
}

new BackgroundService();