console.log("TruthLens: Content script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "show_verification") {
    showOverlay(request.data);
  } else if (request.action === "show_loading") {
    showLoading(request.data);
  } else if (request.action === "show_error") {
    showError(request.data);
  }
});

function createOverlayBase() {
  const existing = document.getElementById("truthlens-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "truthlens-overlay";
  overlay.style.cssText = `
    position: fixed; top: 20px; right: 20px; width: 320px;
    background: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
    border-radius: 12px; z-index: 999999; font-family: sans-serif;
    border: 1px solid #e5e7eb; overflow: hidden; animation: slideIn 0.3s ease-out;
  `;

  const header = document.createElement("div");
  header.style.cssText = `background: #f3f4f6; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;`;
  header.innerHTML = `
    <span style="font-weight: 600; color: #111827; display: flex; align-items: center; gap: 6px;">🕵️‍♂️ TruthLens</span>
    <button id="truthlens-close" style="background:none; border:none; cursor:pointer; font-size: 18px; color: #6b7280;">&times;</button>
  `;

  overlay.appendChild(header);
  document.body.appendChild(overlay);

  document.getElementById("truthlens-close").onclick = () => overlay.remove();

  return overlay;
}

function showLoading(data) {
  const overlay = createOverlayBase();
  const content = document.createElement("div");
  content.style.padding = "20px";
  content.style.textAlign = "center";
  content.innerHTML = `
    <div style="margin-bottom: 10px; color: #4b5563;">Verifying claim...</div>
    <div class="truthlens-spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #4f46e5; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
    <div style="margin-top: 12px; font-size: 12px; color: #9ca3af; font-style: italic;">"${data.claim.substring(0, 50)}..."</div>
  `;
  overlay.appendChild(content);

  // Add spin keyframes
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

function showOverlay(data) {
  const overlay = createOverlayBase();
  const content = document.createElement("div");
  content.style.padding = "16px";
  content.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">CLAIM</div>
      <div style="font-size: 14px; color: #111827; font-style: italic;">"${data.claim}"</div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">VERDICT</div>
      <div style="font-size: 16px; font-weight: bold; color: ${getColorForRating(data.rating)};">
        ${data.verdict}
      </div>
    </div>
    <div style="font-size: 12px; color: #4b5563; line-height: 1.4;">
      ${data.explanation}
    </div>
    ${data.ual && data.ual.startsWith('did:dkg:') ? `
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
        <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Permanent DKG Record</div>
        <a href="https://dkg.origintrail.io/explore?ual=${data.ual}" target="_blank" style="font-size: 11px; color: #4f46e5; text-decoration: none; display: flex; align-items: center; gap: 4px;">
          View on DKG Explorer ↗
        </a>
      </div>
    ` : ''}
  `;
  overlay.appendChild(content);
}

function showError(data) {
  const overlay = createOverlayBase();
  const content = document.createElement("div");
  content.style.padding = "16px";
  content.innerHTML = `
    <div style="color: #dc2626; font-weight: bold; margin-bottom: 8px;">Error</div>
    <div style="font-size: 13px; color: #4b5563;">${data.message}</div>
  `;
  overlay.appendChild(content);
}

function getColorForRating(rating) {
  if (rating >= 4) return "#059669";
  if (rating <= 2) return "#dc2626";
  return "#d97706";
}
