// Configuration
const PROXY_URL = "http://localhost:3000/verify";
let LLM_URL = "http://localhost:8081/v1/chat/completions"; // Default Gaia/LLM URL
let USE_MOCK = false;

// Load settings on startup
chrome.storage.sync.get(['dkgUrl', 'useMock'], (result) => {
    if (result.dkgUrl) LLM_URL = result.dkgUrl;
    if (result.useMock !== undefined) USE_MOCK = result.useMock;
    checkConnection();
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.dkgUrl) {
        LLM_URL = changes.dkgUrl.newValue;
        checkConnection();
    }
    if (changes.useMock) {
        USE_MOCK = changes.useMock.newValue;
    }
});

function checkConnection() {
    // Check if the Proxy is running
    fetch(PROXY_URL.replace('/verify', '/health'), { method: 'GET' })
        .then(res => {
            if (res.ok) {
                console.log("Proxy connected!");
                chrome.action.setBadgeText({ text: "ON" });
                chrome.action.setBadgeBackgroundColor({ color: "#059669" });
            } else {
                throw new Error("Proxy Status " + res.status);
            }
        })
        .catch(err => {
            console.log("Proxy disconnected:", err);
            chrome.action.setBadgeText({ text: "OFF" });
            chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
        });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "truthlens-verify",
        title: "Verify with TruthLens",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "truthlens-verify") {
        const selectedText = info.selectionText;

        // Helper to send message with retry logic
        const sendMessage = async (tabId, message) => {
            try {
                await chrome.tabs.sendMessage(tabId, message);
            } catch (err) {
                console.log("Content script not ready, injecting...", err);
                await chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ["styles.css"]
                });
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ["content.js"]
                });
                // Retry message after injection
                await new Promise(r => setTimeout(r, 100));
                await chrome.tabs.sendMessage(tabId, message);
            }
        };

        await sendMessage(tab.id, {
            action: "show_loading",
            data: { claim: selectedText }
        });

        verifyClaim(selectedText)
            .then(result => {
                sendMessage(tab.id, {
                    action: "show_verification",
                    data: result
                });
            })
            .catch(err => {
                console.error("Verification failed:", err);
                sendMessage(tab.id, {
                    action: "show_error",
                    data: { message: err.message }
                });
            });
    }
});

async function verifyClaim(text) {
    if (USE_MOCK) {
        return mockVerify(text);
    }

    try {
        console.log("Sending to Proxy:", PROXY_URL);
        console.log("Using LLM:", LLM_URL);

        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claim: text,
                llmUrl: LLM_URL
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Server Error: " + response.status);
        }

        const data = await response.json();
        return data;

    } catch (err) {
        console.error("Verification failed:", err);
        throw err;
    }
}

function parseAgentResponse(content, text) {
    // Extract Rating (looks for "**Rating:** 1" or similar)
    const ratingMatch = content.match(/\*\*Rating:\*\*\s*(\d+)/i) || content.match(/Rating:\s*(\d+)/i);
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : 3;

    // Extract Explanation (looks for "**Short Explanation:** ...")
    // We capture everything until the next bold header or end of string
    const explanationMatch = content.match(/\*\*Short Explanation:\*\*\s*([\s\S]*?)(?=\*\*UAL|\n\*\*|$)/i) || content.match(/Explanation:\s*([\s\S]*?)(?=UAL|$)/i);
    let explanation = explanationMatch ? explanationMatch[1].trim() : content;

    // Clean up explanation if it contains the raw rating/UAL by mistake
    explanation = explanation.replace(/\*\*Rating:\*\* \d+/, '').replace(/\*\*UAL.*$/, '').trim();

    // Extract UAL (looks for "**UAL...:** did:dkg:...")
    const ualMatch = content.match(/did:dkg:otp:\S+/);
    const ual = ualMatch ? ualMatch[0] : null;

    return {
        claim: text,
        verdict: rating >= 4 ? "Verified True" : (rating <= 2 ? "Verified False" : "Uncertain"),
        rating: rating,
        explanation: explanation,
        ual: ual
    };
}

async function mockVerify(text) {
    console.log("Mock Verifying:", text);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const isTrue = Math.random() > 0.5;

    return {
        claim: text,
        verdict: isTrue ? "Verified True" : "Verified False",
        rating: isTrue ? 5 : 1,
        explanation: isTrue
            ? "This claim is supported by multiple sources on the DKG. (MOCK DATA)"
            : "This claim contradicts known facts in the DKG. (MOCK DATA)",
        ual: null // No UAL for mock to avoid confusion
    };
}
