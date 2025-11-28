# TruthLens 🔍

> AI-Powered Fact Checking with Decentralized Knowledge Storage

TruthLens is a browser extension that combats misinformation by providing instant, AI-powered fact-checking of online claims while storing verified results on the OriginTrail Decentralized Knowledge Graph (DKG).

<img width="320" height="781" alt="Screenshot at Nov 28 20-03-44" src="https://github.com/user-attachments/assets/7d584533-0d97-4081-9335-6b07aab934f3" />
<img width="1837" height="1238" alt="Screenshot at Nov 29 02-00-55" src="https://github.com/user-attachments/assets/876f0aaf-73d4-4da6-9c8e-313c0ab827a6" />
<img width="1676" height="1259" alt="Screenshot at Nov 29 02-08-44" src="https://github.com/user-attachments/assets/fa8fbe51-8d82-4fc6-96e1-38e701cc5ce8" />

[Video Demo](https://youtu.be/pbPOmorgYX0)

## 🌟 Features

- **Instant Fact Checking**: Right-click any text on the web to verify claims instantly
- **AI-Powered Analysis**: Uses Gaia MoE (Mixture of Experts) model for intelligent claim verification
- **Decentralized Storage**: All verifications are published to OriginTrail's DKG for transparency and immutability
- **Blockchain-Backed**: Leverages NeuroWeb testnet for decentralized proof of verification
- **Visual Feedback**: Clear, intuitive UI showing claim ratings (1-5 scale)
- **Permanent Records**: Each verification gets a unique UAL (Universal Asset Locator) on the DKG

## 🏗️ Architecture

```
┌─────────────────┐
│  Browser        │
│  Extension      │
│  (Chrome)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Proxy Server   │
│  (Node.js)      │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌──────────────┐
│  Gaia   │ │ OriginTrail  │
│  MoE AI │ │     DKG      │
└─────────┘ └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+)
- OriginTrail DKG Node running locally
- Gaia Node (or compatible LLM endpoint)
- Chrome/Chromium browser

### Installation

1. **Clone the repository**
   ```bash
   cd truth-lens
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```env
   # DKG Configuration
   PRIVATE_KEY=your_wallet_private_key
   PUBLIC_KEY=your_wallet_address
   DKG_PORT=9200
   BLOCKCHAIN_ID=otp:20430

   # Gaia/LLM Configuration
   LLM_URL=http://localhost:8081/v1/chat/completions
   LLM_MODEL=gpt-oss-20b-MXFP4_MOE
   ```

4. **Start the proxy server**
   ```bash
   node server.js
   ```

5. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `truth-lens` directory

## 📖 Usage

### Verifying a Claim

1. **Select text** on any webpage containing a factual claim
2. **Right-click** and choose "Verify with TruthLens"
3. **Wait** for the AI analysis (2-5 seconds)
4. **View results** in the popup showing:
   - Verdict (True/False/Uncertain)
   - Rating (1-5 scale)
   - Explanation
   - DKG UAL (if published)

### Example Claims to Test

✅ **True Claims:**
- "The Earth orbits around the Sun"
- "Water boils at 100 degrees Celsius at sea level"

❌ **False Claims:**
- "The Moon is made of cheese"
- "Humans only use 10% of their brain"

❓ **Uncertain Claims:**
- Recent news events requiring context
- Complex political statements

## 🔧 Technical Details

### Components

#### Browser Extension
- **background.js**: Service worker handling context menus and verification requests
- **content.js**: Content script for displaying verification results on pages
- **popup.js**: Extension popup interface
- **manifest.json**: Chrome extension configuration

#### Proxy Server
- **server.js**: Express server coordinating between extension, Gaia, and DKG
- Handles LLM communication
- Manages DKG asset creation and publishing
- Provides health checks and error handling

### Data Flow

1. User selects text and triggers verification
2. Extension sends claim to proxy server
3. Proxy queries Gaia MoE for AI analysis
4. Response is parsed and structured as JSON-LD
5. Verification is published to DKG
6. UAL is returned to user for permanent reference

### DKG Schema

Verifications are stored using Schema.org `ClaimReview` format:

```json
{
  "@context": "https://schema.org",
  "@type": "ClaimReview",
  "claimReviewed": "The claim text",
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": 4,
    "bestRating": "5",
    "worstRating": "1",
    "alternateName": "True"
  },
  "text": "Detailed explanation",
  "author": {
    "@type": "Organization",
    "name": "TruthLens AI"
  },
  "datePublished": "2025-11-28T20:00:00Z",
  "inLanguage": "en"
}
```

## 🛠️ Development

### Project Structure

```
truth-lens/
├── background.js       # Extension background service worker
├── content.js          # Content script for UI injection
├── popup.js           # Extension popup
├── popup.html         # Popup HTML
├── styles.css         # Extension styles
├── server.js          # Proxy server
├── manifest.json      # Extension manifest
├── .env              # Environment configuration
└── icons/            # Extension icons
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | DKG wallet private key | - |
| `PUBLIC_KEY` | DKG wallet address | - |
| `DKG_PORT` | DKG API port | 9200 |
| `BLOCKCHAIN_ID` | Blockchain network | otp:20430 |
| `LLM_URL` | Gaia/LLM endpoint | - |
| `LLM_MODEL` | Model identifier | gpt-oss-20b-MXFP4_MOE |
| `DEMO_MODE` | Skip DKG publishing | false |

### Testing

```bash
# Test proxy server health
curl http://localhost:3000/health

# Test DKG connectivity
curl http://localhost:9200/health

# Test verification endpoint
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"claim": "The Earth is round", "llmUrl": "http://localhost:8081/v1/chat/completions"}'
```

## 🎯 Use Cases

1. **News Verification**: Quickly fact-check breaking news claims
2. **Social Media**: Verify viral posts and trending topics
3. **Research**: Validate scientific claims and statistics
4. **Education**: Help students identify reliable information
5. **Content Moderation**: Assist platforms in identifying misinformation

## 🌐 Technologies Used

- **Frontend**: Chrome Extension APIs, Vanilla JavaScript
- **Backend**: Node.js, Express
- **AI**: Gaia MoE (Mixture of Experts LLM)
- **Blockchain**: OriginTrail DKG on NeuroWeb Testnet
- **Storage**: Decentralized Knowledge Graph (DKG)
- **Standards**: Schema.org JSON-LD, W3C ClaimReview

## 🔐 Privacy & Security

- Claims are processed locally or through your configured LLM
- No data is sent to third parties without your explicit DKG publishing
- All blockchain transactions are transparent and auditable
- Wallet private keys remain local and encrypted

## 📊 DKG Publishing Details

- **Network**: NeuroWeb Testnet (otp:20430)
- **Cost**: ~0.001 TRAC per verification
- **Epochs**: 2 (configurable)
- **Visibility**: Public (all verifications are transparent)
- **Keywords**: TruthLens, FactCheck

## 🐛 Troubleshooting

### Extension not appearing
- Ensure developer mode is enabled in Chrome
- Reload the extension after making changes

### "Proxy disconnected" error
- Verify server is running: `node server.js`
- Check server is on port 3000: `curl http://localhost:3000/health`

### DKG publishing fails
- Verify DKG node is running: `curl http://localhost:9200/health`
- Check wallet has sufficient TRAC and NEURO tokens
- Ensure correct blockchain ID in .env

### Gaia/LLM connection issues
- Verify LLM endpoint is accessible
- Check LLM_URL in .env is correct
- Test with: `curl http://localhost:8081/v1/chat/completions`

## 🚀 Roadmap

- [ ] Multi-language support
- [ ] Firefox extension version
- [ ] Advanced AI models integration
- [ ] Collaborative fact-checking
- [ ] Browser history of verifications
- [ ] Custom verification templates
- [ ] API for third-party integrations
