document.addEventListener('DOMContentLoaded', function () {
    const statusDiv = document.getElementById('connection-status');
    const settingsBtn = document.getElementById('settings-btn');
    const saveBtn = document.getElementById('save-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const urlInput = document.getElementById('agent-url');
    const mockCheckbox = document.getElementById('use-mock');

    // Load settings
    chrome.storage.sync.get(['dkgUrl', 'useMock'], (result) => {
        urlInput.value = result.dkgUrl || "https://0xfa1fc68813d687215be75fba4fffb60f184590bc.gaia.domains/v1/chat/completions";
        mockCheckbox.checked = result.useMock !== undefined ? result.useMock : true;
        checkStatus(urlInput.value);
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
    });

    saveBtn.addEventListener('click', () => {
        const newUrl = urlInput.value;
        const useMock = mockCheckbox.checked;

        chrome.storage.sync.set({ dkgUrl: newUrl, useMock: useMock }, () => {
            statusDiv.textContent = "Saved!";
            setTimeout(() => checkStatus(newUrl), 1000);
        });
    });

    function checkStatus(url) {
        statusDiv.textContent = "Checking...";
        statusDiv.className = "status";

        if (mockCheckbox.checked) {
            statusDiv.textContent = "⚠️ Using Mock Mode";
            statusDiv.classList.add('mock');
            return;
        }

        // Probe the base URL (remove /v1/chat...)
        const baseUrl = url.split('/v1')[0].split('/api')[0];

        fetch(baseUrl, { method: 'HEAD' })
            .then(res => {
                if (res.ok) {
                    statusDiv.textContent = "Connected to DKG";
                    statusDiv.classList.add('connected');
                } else {
                    statusDiv.textContent = "Error: " + res.status;
                }
            })
            .catch(() => {
                statusDiv.textContent = "Disconnected";
            });
    }
});
