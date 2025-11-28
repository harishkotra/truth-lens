require('dotenv').config(); // Load environment variables
const express = require('express');
const cors = require('cors');
const DKG = require('dkg.js');
// Polyfill fetch if missing (using node-fetch@2)
if (!globalThis.fetch) {
    globalThis.fetch = require('node-fetch');
}

const app = express();
app.use(cors());
// Increase limit just in case
app.use(express.json({ limit: '50mb' }));

// Initialize DKG Client
const dkg = new DKG({
    endpoint: process.env.OT_NODE_HOSTNAME || 'http://localhost',
    port: process.env.DKG_PORT || 9200, // DKG API port (not the node engine port)
    blockchain: {
        name: process.env.BLOCKCHAIN_ID || 'otp:2043', // Default to NeuroWeb Testnet
        publicKey: process.env.PUBLIC_KEY,
        privateKey: process.env.PRIVATE_KEY,
    },
    maxNumberOfRetries: 30,
    frequency: 2,
    contentType: 'all'
});

// Middleware to log all requests
app.use((req, res, next) => {
    console.log(`\n📨 ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log("Body:", JSON.stringify(req.body, null, 2).substring(0, 200) + "...");
    }
    next();
});

// Configuration
const PORT = 3000;
const DEFAULT_LLM_URL = process.env.LLM_URL || "http://localhost:11434/v1/chat/completions";

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.post('/verify', async (req, res) => {
    const { claim, llmUrl } = req.body;
    // Prefer the request's llmUrl if valid, otherwise use the server's default (from .env)
    const targetLlmUrl = (llmUrl && llmUrl.startsWith('http')) ? llmUrl : DEFAULT_LLM_URL;

    if (!claim) {
        console.error("❌ Missing 'claim' in request body");
        return res.status(400).json({ error: "Missing 'claim' field" });
    }

    console.log(`🔍 Verifying Claim: "${claim.substring(0, 50)}..."`);
    console.log(`🤖 Using LLM: ${targetLlmUrl}`);

    if (process.env.DEMO_MODE === 'true') {
        console.log("⚠️ DEMO MODE ACTIVE: Returning mock verification.");
        await new Promise(r => setTimeout(r, 1500)); // Simulate realistic delay

        // Generate a realistic-looking mock UAL
        const mockUAL = `did:dkg:otp:20430/0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;

        // Still get real AI verdict
        const verdict = await queryLLM(targetLlmUrl, claim);
        console.log(`✅ AI Verdict: ${verdict.rating}/5`);

        return res.json({
            claim,
            rating: verdict.rating,
            explanation: verdict.explanation,
            verdict: verdict.rating >= 4 ? "Verified True" : (verdict.rating <= 2 ? "Verified False" : "Uncertain"),
            ual: mockUAL
        });
    }

    try {
        // 1. Ask LLM for Verdict
        const verdict = await queryLLM(targetLlmUrl, claim);
        console.log(`✅ Verdict: ${verdict.rating}/5`);

        // 2. Create JSON-LD Object
        const jsonLd = createJsonLd(claim, verdict);

        // 3. Publish to DKG using SDK
        console.log("⛓️ Publishing to DKG...");
        console.log("📋 JSON-LD to publish:", JSON.stringify(jsonLd, null, 2));
        let ual = null;
        let dkgErrorMsg = null;

        try {
            const dkgPort = process.env.DKG_PORT || 9200;
            console.log("🔧 DKG Config:", {
                endpoint: process.env.OT_NODE_HOSTNAME || 'http://localhost',
                port: dkgPort,
                blockchain: process.env.BLOCKCHAIN_ID || 'otp:2043',
                publicKey: process.env.PUBLIC_KEY
            });

            // First, test if DKG node is reachable
            try {
                const healthCheck = await fetch(`${process.env.OT_NODE_HOSTNAME || 'http://localhost'}:${dkgPort}/health`);
                console.log(`🏥 DKG Node health check: ${healthCheck.status} ${healthCheck.statusText}`);
                const healthData = await healthCheck.json();
                console.log(`🏥 Health response:`, healthData);
            } catch (healthError) {
                console.warn("⚠️ DKG Node health check failed:", healthError.message);
            }

            const result = await dkg.asset.create(jsonLd, {
                keywords: ['TruthLens', 'FactCheck'],
                visibility: 'public',
                epochsNum: 2 // Reduced from 5 to 2 for faster publishing
            });
            console.log("🎉 Published! Result:", JSON.stringify(result, null, 2));
            ual = result.UAL;
        } catch (dkgError) {
            console.error("❌ DKG Publish Failed:");
            console.error("Error object:", JSON.stringify(dkgError, Object.getOwnPropertyNames(dkgError), 2));
            if (dkgError.stack) console.error("Stack trace:", dkgError.stack);
            if (dkgError.response) {
                console.error("Error response status:", dkgError.response.status);
                console.error("Error response data:", JSON.stringify(dkgError.response.data, null, 2));
            }
            if (dkgError.cause) console.error("Error cause:", dkgError.cause);
            if (dkgError.code) console.error("Error code:", dkgError.code);

            // Extract more detailed error info
            let errorDetails = dkgError.message || String(dkgError);

            if (dkgError.response) {
                errorDetails += ` | HTTP ${dkgError.response.status}`;
                if (dkgError.response.data) {
                    errorDetails += ` | ${JSON.stringify(dkgError.response.data)}`;
                }
            }

            if (dkgError.cause) {
                errorDetails += ` | Cause: ${dkgError.cause.message || dkgError.cause}`;
            }

            if (dkgError.code) {
                errorDetails += ` | Code: ${dkgError.code}`;
            }

            // If still no details, try to get more info from the error object
            if (errorDetails === "Unable to publish: " || errorDetails.length < 30) {
                const errorKeys = Object.keys(dkgError);
                if (errorKeys.length > 0) {
                    errorDetails += ` | Keys: ${errorKeys.join(', ')}`;
                }
            }

            dkgErrorMsg = errorDetails || "DKG publish failed with unknown error";
            console.error("📝 Detailed error message:", dkgErrorMsg);
            // We do NOT throw here. We want to return the LLM verdict even if DKG fails.
        }

        // 4. Return Result
        const response = {
            claim,
            rating: verdict.rating,
            explanation: verdict.explanation,
            verdict: verdict.rating >= 4 ? "Verified True" : (verdict.rating <= 2 ? "Verified False" : "Uncertain"),
            ual: ual
        };

        // Only include error in response if in development mode and there's an error
        if (process.env.NODE_ENV === 'development' && dkgErrorMsg) {
            response.dkgError = dkgErrorMsg;
        }

        res.json(response);

    } catch (error) {
        console.error("❌ Error Processing Request:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

async function queryLLM(url, claim) {
    console.log(`📡 Querying LLM at ${url}...`);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // Increased timeout to 30s

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: process.env.LLM_MODEL || "llama",
                messages: [
                    {
                        role: "system",
                        content: `You are a fact-checking assistant. Analyze the claim and return a JSON object with two fields:
                        - "rating": an integer from 1 (False) to 5 (True).
                        - "explanation": a short summary string.
                        Do NOT return any other text or internal monologue. Return ONLY the JSON.`
                    },
                    { role: "user", content: `Claim: "${claim}"` }
                ],
                stream: false,
                temperature: 0.1
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`LLM responded with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle different LLM response formats
        // Gaia MoE might return: data.choices[0].message.content (OpenAI format)
        // OR data.message.content (simplified format)
        // OR data.response (Ollama format)
        let content = "";
        if (data.choices && data.choices[0] && data.choices[0].message) {
            content = data.choices[0].message.content;
        } else if (data.message && data.message.content) {
            content = data.message.content;
        } else if (data.response) {
            content = data.response;
        } else if (typeof data === 'string') {
            content = data;
        } else {
            content = JSON.stringify(data);
        }

        console.log("🤖 Raw LLM Response:", content.substring(0, 300) + "...");
        console.log("🔍 Full response structure:", JSON.stringify(data).substring(0, 500) + "...");

        // Clean Gaia MoE special tokens first
        let cleanContent = content
            .replace(/<\|channel\|>/g, '')
            .replace(/<\|message\|>/g, '')
            .replace(/<\|end\|>/g, '')
            .replace(/<\|.*?\|>/g, '') // Remove any other special tokens
            .trim();

        console.log("🧹 Cleaned content:", cleanContent.substring(0, 300) + "...");

        // Try to extract JSON - handle multiple JSON objects if present
        const jsonMatches = cleanContent.match(/\{[\s\S]*?\}/g);
        if (jsonMatches) {
            // Try each JSON match until we find a valid one
            for (const jsonMatch of jsonMatches) {
                try {
                    const parsed = JSON.parse(jsonMatch);
                    if (parsed.rating !== undefined || parsed.explanation !== undefined) {
                        return {
                            rating: parsed.rating || 3,
                            explanation: parsed.explanation || "No explanation provided."
                        };
                    }
                } catch (e) {
                    // Try next match
                    continue;
                }
            }
        }

        // Fallback regex parsing for more flexible formats using cleaned content
        const ratingMatch = cleanContent.match(/rating["\s:]+(\d)/i) ||
                           cleanContent.match(/(\d)\/5/) ||
                           cleanContent.match(/"rating":\s*(\d)/) ||
                           cleanContent.match(/Rating:\s*(\d)/i);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : 3;

        // Extract explanation more robustly
        const explanationMatch = cleanContent.match(/explanation["\s:]+["']?([^"'\n}]+)/i) ||
                                cleanContent.match(/"explanation":\s*"([^"]+)"/) ||
                                cleanContent.match(/Explanation:\s*(.+?)(?:\n|$)/i);
        let explanation = explanationMatch ? explanationMatch[1].trim() : cleanContent;

        // Clean up explanation
        explanation = explanation
            .replace(/<\|.*?\|>/g, '') // Remove special tokens
            .replace(/\{.*?\}/g, '')   // Remove remaining JSON fragments
            .replace(/rating["\s:]+\d/gi, '') // Remove rating mentions
            .trim();

        if (explanation.length > 200) {
            explanation = explanation.substring(0, 200) + "...";
        }

        if (!explanation || explanation.length < 10) {
            explanation = "Unable to extract explanation from LLM response.";
        }

        return {
            rating: rating,
            explanation: explanation
        };

    } catch (error) {
        console.error("❌ LLM Query Error:", error.message);
        throw new Error(`LLM Connection Failed: ${error.message}. Is Gaia/Ollama running?`);
    }
}

function createJsonLd(claim, verdict) {
    return {
        "@context": "https://schema.org",
        "@type": "ClaimReview",
        "claimReviewed": claim,
        "reviewRating": {
            "@type": "Rating",
            "ratingValue": verdict.rating,
            "bestRating": "5",
            "worstRating": "1",
            "alternateName": verdict.rating >= 4 ? "True" : (verdict.rating <= 2 ? "False" : "Uncertain")
        },
        "text": verdict.explanation || "No explanation provided.",
        "author": {
            "@type": "Organization",
            "name": "TruthLens AI"
        },
        "datePublished": new Date().toISOString(),
        "inLanguage": "en"
    };
}

app.listen(PORT, () => {
    console.log(`\n🚀 TruthLens Proxy Server running on http://localhost:${PORT}`);
});
