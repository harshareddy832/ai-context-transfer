# AI Context Transfer
Are you an AI power user with rate limit problems, here's your solution:
Browser extension that transfers conversation context between AI chatbots when you hit rate limits. 

## Note
Still in Dev. 


## What it does

- **Detects rate limits** on ChatGPT and Claude automatically
- **Extracts conversations** and creates smart summaries 
- **Transfers context** to continue conversations elsewhere
- **Works locally** with Ollama or cloud APIs (OpenAI/Anthropic)

## Key Features

- Auto-detection of rate limits with one-click transfer
- Manual summarization with floating button
- Privacy-first design with local processing
- Clean UI with editable summaries
- Support for ChatGPT and Claude

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" 
4. Click "Load unpacked" and select the project folder

## Setup

### Choose your AI provider:

**Option A: Ollama (Local/Private)**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2
ollama serve
```

**Option B: Cloud APIs**
- Get OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)
- Get Anthropic API key from [console.anthropic.com](https://console.anthropic.com/keys)

### Configure extension:
1. Click extension icon → Settings
2. Choose your LLM provider
3. Enter API key (if using cloud)
4. Test connection

## Usage

**Automatic mode:**
1. Extension detects rate limits 
2. Click "Transfer Context" button
3. Review and edit summary
4. Copy to clipboard or new tab

**Manual mode:**
1. Click floating button on chat page
2. Or use extension popup → "Summarize"
3. Edit summary as needed
4. Transfer to continue elsewhere

## Supported Platforms

- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)

## Development

Load extension in developer mode to test on ChatGPT/Claude pages.

See `OLLAMA_SETUP.md` for detailed local AI setup instructions.

## License

MIT License - Educational and development purposes. Respect platform terms of service.
