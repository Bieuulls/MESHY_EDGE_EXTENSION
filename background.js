// Meshy.ai Bulk Downloader - Background Service Worker
// Otimizado para arquivos do Blender (.GLB e .FBX) organizados em pastas

let activeDownloads = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_FILE') {
    handleDownload(message.payload, sender.tab?.id)
      .then(downloadId => sendResponse({ success: true, downloadId }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'DOWNLOAD_BATCH') {
    handleBatchDownload(message.payload, sender.tab?.id)
      .then(results => sendResponse({ success: true, results }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_ACTIVE_DOWNLOADS') {
    sendResponse({ count: activeDownloads.size });
    return false;
  }
});

async function handleDownload(item, tabId) {
  const { url, filename, subfolder = 'Personagens_Texturizados' } = item;
  if (!url) throw new Error('URL de download inválida');

  // Limpeza de caracteres inválidos para pastas do Windows
  const cleanSubfolder = subfolder.replace(/[\\:*?"<>|]/g, '_');
  const cleanFilename = filename.replace(/[\\/:*?"<>|]/g, '_');
  
  // Caminho organizado especificamente para Blender
  const targetPath = `Meshy_Blender/${cleanSubfolder}/${cleanFilename}`;

  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,
      filename: targetPath,
      conflictAction: 'uniquify',
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        activeDownloads.set(downloadId, { filename: targetPath, tabId });
        resolve(downloadId);
      }
    });
  });
}

async function handleBatchDownload(items, tabId) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const downloadId = await handleDownload(item, tabId);
      results.push({ item, success: true, downloadId });
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'DOWNLOAD_PROGRESS',
          current: i + 1,
          total: items.length,
          item
        }).catch(() => {});
      }
      await new Promise(r => setTimeout(r, 400)); // Delay para estabilidade no Edge
    } catch (err) {
      results.push({ item, success: false, error: err.message });
    }
  }
  return results;
}

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    activeDownloads.delete(delta.id);
  }
  if (delta.state && delta.state.current === 'interrupted') {
    activeDownloads.delete(delta.id);
  }
});
