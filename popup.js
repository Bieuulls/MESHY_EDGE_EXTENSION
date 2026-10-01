// Meshy Downloader - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const viewActive = document.getElementById('view-active');
  const viewInactive = document.getElementById('view-inactive');
  const countEl = document.getElementById('popup-model-count');
  const btnDownload = document.getElementById('btn-popup-download-all');
  const btnScroll = document.getElementById('btn-scroll-load');
  const btnOpenMeshy = document.getElementById('btn-open-meshy');

  // Check active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const isMeshy = tab && tab.url && (tab.url.includes('meshy.ai') || tab.url.includes('meshy.cn'));

  if (!isMeshy) {
    statusDot.classList.remove('online');
    viewActive.style.display = 'none';
    viewInactive.style.display = 'flex';

    btnOpenMeshy.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.meshy.ai/workspace' });
    });
    return;
  }

  // Active on Meshy
  statusDot.classList.add('online');
  viewActive.style.display = 'flex';
  viewInactive.style.display = 'none';

  // Request model count from content script
  function refreshCount() {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_MODELS_COUNT' }, (res) => {
      if (chrome.runtime.lastError) {
        countEl.innerText = '0';
        return;
      }
      if (res && typeof res.count === 'number') {
        countEl.innerText = res.count;
      }
    });
  }

  refreshCount();
  const pollInterval = setInterval(refreshCount, 1500);
  window.addEventListener('unload', () => clearInterval(pollInterval));

  // Trigger Download All
  btnDownload.addEventListener('click', () => {
    btnDownload.innerText = '⏳ Iniciando...';
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_DOWNLOAD_ALL' }, (res) => {
      setTimeout(() => {
        btnDownload.innerText = '⚡ Baixar Tudo para o Blender';
      }, 2000);
    });
  });

  // Trigger Crawl Pages
  btnScroll.addEventListener('click', () => {
    btnScroll.innerText = '📑 Varrendo...';
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const btn = document.getElementById('meshy-btn-crawl-pages');
        if (btn) btn.click();
      }
    });
    setTimeout(() => {
      btnScroll.innerText = '📑 Varrer Páginas';
    }, 2500);
  });
});
