# 🚀 Ollama Setup Guide for AI Context Transfer Extension

## Overview
Ollama allows you to run large language models locally for privacy-first AI summarization. This guide will help you set up Ollama and integrate it with your AI Context Transfer extension.

## Step 1: Install Ollama

### macOS
```bash
# Method 1: Direct installation
curl -fsSL https://ollama.com/install.sh | sh

# Method 2: Using Homebrew
brew install ollama
```

### Windows
1. Visit https://ollama.com/download
2. Download the Windows installer
3. Run the installer and follow the setup wizard

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

## Step 2: Start Ollama Service

After installation, start the Ollama service:

```bash
# Start Ollama service (runs in background)
ollama serve
```

This will start Ollama on `http://localhost:11434` (default port).

## Step 3: Install a Model for Summarization

Choose and install a model suitable for summarization. Here are recommended options:

### Recommended Models:

**For Fast Summarization (Lightweight):**
```bash
# Install Llama 3.2 (3B parameters) - Fast and efficient
ollama pull llama3.2

# Or Phi-3 Mini (3.8B parameters) - Good for summarization
ollama pull phi3
```

**For Better Quality (Medium):**
```bash
# Install Llama 3.1 (8B parameters) - Balanced performance
ollama pull llama3.1

# Or Gemma 2 (9B parameters) - Good reasoning
ollama pull gemma2
```

**For Best Quality (Heavy):**
```bash
# Install Llama 3.1 (70B parameters) - Highest quality (requires 64GB+ RAM)
ollama pull llama3.1:70b

# Or Qwen2.5 (32B parameters) - Good for complex tasks
ollama pull qwen2.5:32b
```

## Step 4: Test Ollama Installation

Test that Ollama is working correctly:

```bash
# Test with a simple prompt
ollama run llama3.2 "Summarize this: Hello world, this is a test message."

# Check running models
ollama ps

# List installed models
ollama list
```

## Step 5: Configure Extension Settings

1. **Open the Extension Settings:**
   - Click on the extension icon
   - Click the settings button (gear icon)

2. **Configure Ollama Settings:**
   - Set **Preferred LLM** to "Ollama"
   - Set **Ollama URL** to `http://localhost:11434`
   - Set **Ollama Model** to the model you installed (e.g., `llama3.2`)

3. **Test Connection:**
   - Click "Test Ollama Connection" in settings
   - You should see a success message if everything is working

## Step 6: Testing Summarization

1. **Navigate to a supported platform:**
   - Go to https://chat.openai.com or https://claude.ai
   - Have a conversation with the AI

2. **Test Manual Summarization:**
   - Click the floating "Summarize Chat" button
   - Or use the extension popup and click "Summarize"

3. **Test Smart Summarization:**
   - Open the extension popup
   - Select "Smart Summary (AI)" from the format dropdown
   - Click "Copy to Clipboard" or "Download File"

## Configuration Options

### Extension Settings Location:
- **Ollama URL**: `http://localhost:11434` (default)
- **Model**: Choose from installed models
- **Summary Length**: Short, Medium, or Long
- **Privacy Mode**: Enable for local-only processing

### Recommended Settings:
```json
{
  "preferredLLM": "ollama",
  "ollamaUrl": "http://localhost:11434",
  "ollamaModel": "llama3.2",
  "summaryLength": "medium",
  "privacyMode": true
}
```

## Troubleshooting

### Common Issues:

1. **"Connection failed" error:**
   ```bash
   # Check if Ollama is running
   ps aux | grep ollama
   
   # Restart Ollama service
   ollama serve
   ```

2. **"Model not found" error:**
   ```bash
   # List available models
   ollama list
   
   # Install the model if missing
   ollama pull llama3.2
   ```

3. **Port already in use:**
   ```bash
   # Kill existing Ollama process
   pkill ollama
   
   # Start on different port
   OLLAMA_HOST=0.0.0.0:11435 ollama serve
   ```
   Then update extension settings to use `http://localhost:11435`

4. **Slow performance:**
   - Try a smaller model (phi3, llama3.2:1b)
   - Increase system memory/swap
   - Use GPU acceleration if available

### Performance Tips:

1. **Model Size Selection:**
   - **4GB RAM**: Use 1B-3B models (llama3.2:1b, phi3:mini)
   - **8GB RAM**: Use 3B-7B models (llama3.2, phi3)
   - **16GB+ RAM**: Use 8B-13B models (llama3.1, gemma2)

2. **Speed Optimization:**
   ```bash
   # Enable GPU acceleration (if available)
   ollama run llama3.2 --gpu
   
   # Reduce context window for faster responses
   ollama run llama3.2 --ctx-size 2048
   ```

## Testing Commands

### Test Ollama API directly:
```bash
# Test basic API call
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Summarize this conversation: Hello world!",
  "stream": false
}'

# Test model availability
curl http://localhost:11434/api/tags
```

### Test with Extension:
1. Open browser console (F12)
2. Test API connection:
```javascript
fetch('http://localhost:11434/api/tags')
  .then(response => response.json())
  .then(data => console.log(data));
```

## Advanced Configuration

### Custom Model Configuration:
```bash
# Create custom model with specific parameters
ollama create summary-model -f - <<EOF
FROM llama3.2
PARAMETER temperature 0.3
PARAMETER top_k 40
PARAMETER top_p 0.9
SYSTEM You are a helpful assistant specialized in creating concise, accurate summaries of conversations.
EOF
```

### Environment Variables:
```bash
# Set custom host/port
export OLLAMA_HOST=0.0.0.0:11434

# Set model storage location
export OLLAMA_MODELS=/path/to/models

# Enable debug logging
export OLLAMA_DEBUG=1
```

## Security Considerations

1. **Local Processing**: All data stays on your machine
2. **Firewall**: Ollama runs on localhost by default
3. **No API Keys**: No external API keys required
4. **Privacy**: Enable privacy mode in extension settings

## Next Steps

After successful setup:
1. Test with different conversation lengths
2. Experiment with different models
3. Adjust summary length settings
4. Configure privacy preferences
5. Set up automatic model updates

## Support

- **Ollama Documentation**: https://ollama.com/
- **Model Library**: https://ollama.com/library
- **GitHub Issues**: https://github.com/ollama/ollama/issues