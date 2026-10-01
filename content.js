// Meshy.ai Bulk Downloader - Content Script
// Otimizado exclusivamente para modelos 3D do Blender (.GLB e .FBX) organizados em pastas

(function() {
  if (window.__MESHY_CONTENT_SCRIPT_INITIALIZED__) return;
  window.__MESHY_CONTENT_SCRIPT_INITIALIZED__ = true;

  const state = {
    models: new Map(),
    selectedFormats: {
      glb: true,
      fbx: true
    },
    activeTabFilter: 'all', // 'all', 'animated', 'textured'
    isDownloading: false,
    isCrawlingPages: false,
    filterText: '',
    minimized: false
  };

  // 1. Ouvir modelos capturados pelo interceptor.js (network)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'MESHY_DOWNLOADER_MODELS_UPDATED') {
      const incoming = e.data.models || [];
      let updated = false;
      for (const m of incoming) {
        if (!state.models.has(m.id)) {
          state.models.set(m.id, m);
          updated = true;
        } else {
          const ex = state.models.get(m.id);
          ex.glb = ex.glb || m.glb;
          ex.fbx = ex.fbx || m.fbx;
          ex.thumbnail = ex.thumbnail || m.thumbnail;
          if (m.isAnimated) {
            ex.isAnimated = true;
            ex.category = 'Modelos_Animados';
          }
        }
      }
      if (updated || incoming.length > 0) {
        updateUI();
      }
    }
  });

  window.postMessage({ type: 'MESHY_DOWNLOADER_GET_ALL' }, '*');

  // 2. Mensagens do background.js
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'DOWNLOAD_PROGRESS') {
      updateProgressBar(msg.current, msg.total, msg.item.filename);
    }
    if (msg.type === 'GET_MODELS_COUNT') {
      sendResponse({ count: state.models.size, models: Array.from(state.models.values()) });
      return false;
    }
    if (msg.type === 'TRIGGER_DOWNLOAD_ALL') {
      startBatchDownload();
      sendResponse({ status: 'started' });
      return false;
    }
  });

  // 3. Interface Flutuante HUD do Meshy Downloader
  let hudContainer = null;

  function createHUD() {
    if (document.getElementById('meshy-downloader-hud')) return;

    hudContainer = document.createElement('div');
    hudContainer.id = 'meshy-downloader-hud';
    hudContainer.className = 'meshy-hud-root';
    hudContainer.innerHTML = `
      <div class="meshy-hud-card" id="meshy-hud-card">
        <div class="meshy-hud-header">
          <div class="meshy-hud-title">
            <span class="meshy-hud-icon">📦</span>
            <span class="meshy-hud-name">Meshy ➔ Blender Downloader</span>
            <span class="meshy-hud-badge" id="meshy-model-count">0</span>
          </div>
          <div class="meshy-hud-actions">
            <button class="meshy-hud-btn-icon" id="meshy-btn-crawl-pages" title="Varrer todas as páginas (1/3, 2/3, 3/3) e listar tudo">
              📑 Varrer Páginas
            </button>
            <button class="meshy-hud-btn-icon" id="meshy-btn-minimize" title="Minimizar">
              ─
            </button>
          </div>
        </div>

        <div class="meshy-hud-body" id="meshy-hud-body">
          <!-- Filtros de Pastas para o Blender -->
          <div class="meshy-hud-section">
            <div class="meshy-filter-tabs">
              <button class="meshy-tab-btn active" data-filter="all">Todos</button>
              <button class="meshy-tab-btn" data-filter="animated">🏃 Animados (Movimento)</button>
              <button class="meshy-tab-btn" data-filter="textured">🎨 Texturizados</button>
            </div>

            <!-- Formatos Estritos para o Blender -->
            <div class="meshy-format-selector">
              <span class="meshy-section-label">Formatos para o Blender:</span>
              <label class="meshy-checkbox-label" title="Formato nativo do Blender com Texturas, Armature e Animação de Ossos">
                <input type="checkbox" id="chk-glb" ${state.selectedFormats.glb ? 'checked' : ''}>
                <span>.GLB (glTF Nativo)</span>
              </label>
              <label class="meshy-checkbox-label" title="Formato com Rigs e Ações para Blender">
                <input type="checkbox" id="chk-fbx" ${state.selectedFormats.fbx ? 'checked' : ''}>
                <span>.FBX (Rigs/Bones)</span>
              </label>
            </div>
          </div>

          <!-- Botão Principal de Download em Lote -->
          <div class="meshy-hud-cta-box">
            <button class="meshy-btn-download-all" id="meshy-btn-download-all">
              ⚡ Baixar Tudo para o Blender (<span id="meshy-btn-count">0</span> modelos)
            </button>
          </div>

          <!-- Barra de Progresso do Download -->
          <div class="meshy-progress-box" id="meshy-progress-box" style="display: none;">
            <div class="meshy-progress-info">
              <span id="meshy-progress-text">Baixando arquivos para o Blender...</span>
              <span id="meshy-progress-pct">0%</span>
            </div>
            <div class="meshy-progress-bar-bg">
              <div class="meshy-progress-bar-fill" id="meshy-progress-fill" style="width: 0%;"></div>
            </div>
            <div class="meshy-progress-filename" id="meshy-progress-file"></div>
          </div>

          <!-- Campo de Busca e Lista de Modelos -->
          <div class="meshy-list-section">
            <div class="meshy-search-row">
              <input type="text" id="meshy-search-input" placeholder="Filtrar modelos (ex: running, character)..." class="meshy-search-field">
            </div>
            <div class="meshy-model-list" id="meshy-model-list">
              <div class="meshy-empty-msg">Nenhum modelo capturado ainda.<br>Clique em "📑 Varrer Páginas" para listar todas as 3 páginas!</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ícone Minimizado Flutuante -->
      <div class="meshy-min-bubble" id="meshy-min-bubble" style="display: none;">
        <span class="meshy-bubble-icon">📦</span>
        <span class="meshy-bubble-count" id="meshy-bubble-count">0</span>
      </div>
    `;

    document.body.appendChild(hudContainer);
    setupHUDEvents();
  }

  function setupHUDEvents() {
    const card = document.getElementById('meshy-hud-card');
    const bubble = document.getElementById('meshy-min-bubble');
    const btnMin = document.getElementById('meshy-btn-minimize');
    const btnCrawl = document.getElementById('meshy-btn-crawl-pages');
    const btnDownloadAll = document.getElementById('meshy-btn-download-all');
    const searchInput = document.getElementById('meshy-search-input');

    // Minimizar / Restaurar
    btnMin.addEventListener('click', () => {
      card.style.display = 'none';
      bubble.style.display = 'flex';
      state.minimized = true;
    });

    bubble.addEventListener('click', () => {
      card.style.display = 'flex';
      bubble.style.display = 'none';
      state.minimized = false;
    });

    // Filtros de abas
    document.querySelectorAll('.meshy-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.meshy-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.activeTabFilter = e.target.getAttribute('data-filter');
        renderModelList();
      });
    });

    // Checkboxes dos formatos Blender
    ['glb', 'fbx'].forEach(fmt => {
      const chk = document.getElementById(`chk-${fmt}`);
      if (chk) {
        chk.addEventListener('change', (e) => {
          state.selectedFormats[fmt] = e.target.checked;
          updateUI();
        });
      }
    });

    // Busca rápida
    searchInput.addEventListener('input', (e) => {
      state.filterText = e.target.value.toLowerCase().trim();
      renderModelList();
    });

    // Varrer todas as páginas (1/3, 2/3, 3/3)
    btnCrawl.addEventListener('click', () => {
      crawlAllPages();
    });

    // Baixar Tudo Organizado em Pastas
    btnDownloadAll.addEventListener('click', () => {
      startBatchDownload();
    });
  }

  // 4. Varrer todas as páginas da galeria do Meshy
  async function crawlAllPages() {
    if (state.isCrawlingPages) return;
    state.isCrawlingPages = true;

    const btnCrawl = document.getElementById('meshy-btn-crawl-pages');
    if (btnCrawl) {
      btnCrawl.classList.add('active');
      btnCrawl.innerText = '⏳ Varrendo...';
    }

    showToast('Iniciando varredura das páginas para o Blender...');

    // Detectar número total de páginas (ex: "1/3")
    let totalPages = 1;
    const pageIndicator = document.querySelector('[data-testid="assets-page-indicator"]') || 
                          document.querySelector('.assets-page-indicator') ||
                          Array.from(document.querySelectorAll('span, div')).find(el => /^\s*\d+\s*\/\s*\d+\s*$/.test(el.innerText));

    if (pageIndicator) {
      const match = pageIndicator.innerText.match(/\d+\/(\d+)/);
      if (match) totalPages = parseInt(match[1], 10);
    }

    const getNextBtn = () => {
      // Botão chevron-right da paginação do Meshy
      const chevron = document.querySelector('.tabler-icon-chevron-right') || 
                      document.querySelector('svg[class*="chevron-right"]');
      if (chevron) {
        return chevron.closest('button');
      }
      return null;
    };

    for (let p = 1; p <= totalPages; p++) {
      if (btnCrawl) btnCrawl.innerText = `Pág ${p}/${totalPages}...`;
      scanDOMForAssets();

      if (p < totalPages) {
        const nextBtn = getNextBtn();
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
          await new Promise(r => setTimeout(r, 1200)); // Aguardar transição e requisições
        }
      }
    }

    // Leitura final
    scanDOMForAssets();

    state.isCrawlingPages = false;
    if (btnCrawl) {
      btnCrawl.classList.remove('active');
      btnCrawl.innerText = '✅ Páginas Lidas!';
      setTimeout(() => {
        btnCrawl.innerText = '📑 Varrer Páginas';
      }, 3500);
    }

    showToast(`Varredura concluída! ${state.models.size} modelos identificados.`);
    updateUI();
  }

  function updateUI() {
    const countEl = document.getElementById('meshy-model-count');
    const btnCountEl = document.getElementById('meshy-btn-count');
    const bubbleCountEl = document.getElementById('meshy-bubble-count');

    const total = state.models.size;
    if (countEl) countEl.innerText = total;
    if (btnCountEl) btnCountEl.innerText = total;
    if (bubbleCountEl) bubbleCountEl.innerText = total;

    renderModelList();
    injectCardButtons();
  }

  function renderModelList() {
    const listEl = document.getElementById('meshy-model-list');
    if (!listEl) return;

    let models = Array.from(state.models.values());

    // Filtrar por aba
    if (state.activeTabFilter === 'animated') {
      models = models.filter(m => m.isAnimated);
    } else if (state.activeTabFilter === 'textured') {
      models = models.filter(m => m.category === 'Personagens_Texturizados' || (m.glb && !m.isAnimated));
    }

    // Filtrar por busca
    if (state.filterText) {
      models = models.filter(m => 
        m.name.toLowerCase().includes(state.filterText) || 
        m.id.toLowerCase().includes(state.filterText)
      );
    }

    if (models.length === 0) {
      listEl.innerHTML = `<div class="meshy-empty-msg">Nenhum modelo compatível com o filtro atual.<br>Clique em "📑 Varrer Páginas" para atualizar.</div>`;
      return;
    }

    let html = '';
    for (const m of models) {
      const thumb = m.thumbnail ? `<img src="${m.thumbnail}" class="meshy-model-thumb" alt="" />` : `<div class="meshy-model-thumb-placeholder">3D</div>`;
      
      const animBadge = m.isAnimated ? `<span class="meshy-anim-tag">🏃 ANIMADO (Blender)</span>` : '';
      const glbBtn = m.glb ? `<button class="meshy-btn-pill" data-action="dl" data-url="${m.glb}" data-subfolder="${m.category}" data-name="${m.name}.glb" title="Baixar .GLB para Blender">.GLB</button>` : '';
      const fbxBtn = m.fbx ? `<button class="meshy-btn-pill" data-action="dl" data-url="${m.fbx}" data-subfolder="${m.category}" data-name="${m.name}.fbx" title="Baixar .FBX para Blender">.FBX</button>` : '';

      // Se ainda não capturou URL direta, botão para abrir e capturar
      const captureBtn = (!m.glb && !m.fbx) ? `<button class="meshy-btn-pill meshy-btn-inspect" data-action="inspect" data-id="${m.id}" title="Carregar no visualizador do Meshy para extrair arquivos do Blender">🔍 Abrir p/ Baixar</button>` : '';

      html += `
        <div class="meshy-model-item ${m.isAnimated ? 'is-animated-card' : ''}">
          ${thumb}
          <div class="meshy-model-meta">
            <div class="meshy-model-title-row">
              <span class="meshy-model-name" title="${m.name}">${m.name}</span>
              ${animBadge}
            </div>
            <div class="meshy-model-folder-path">📁 Meshy_Blender/${m.category}/</div>
          </div>
          <div class="meshy-model-actions">
            ${glbBtn}
            ${fbxBtn}
            ${captureBtn}
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;

    // Ações dos botões de download individuais
    listEl.querySelectorAll('[data-action="dl"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.target.getAttribute('data-url');
        const filename = e.target.getAttribute('data-name');
        const subfolder = e.target.getAttribute('data-subfolder') || 'Personagens_Texturizados';
        downloadSingleFile(url, filename, subfolder);
      });
    });

    // Ações de inspeção para modelos sem link direto ainda
    listEl.querySelectorAll('[data-action="inspect"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        openCardInMeshy(id);
      });
    });
  }

  function downloadSingleFile(url, filename, subfolder = 'Personagens_Texturizados') {
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      payload: { url, filename, subfolder }
    }, (res) => {
      if (res && res.success) {
        showToast(`Baixando: ${filename} ➔ Meshy_Blender/${subfolder}/`);
      } else {
        showToast(`Erro ao baixar: ${res?.error || 'Falha'}`, true);
      }
    });
  }

  // Acionar clique no card correspondente para carregar no 3D do Meshy
  function openCardInMeshy(taskId) {
    const cards = document.querySelectorAll('[data-testid="assets-card"]');
    for (const card of cards) {
      if (card.dataset.meshyTaskId === taskId || card.innerHTML.includes(taskId)) {
        card.click();
        showToast('Carregando modelo no Meshy para capturar o arquivo .GLB / .FBX...');
        return;
      }
    }
    showToast('Abra este modelo na grade do Meshy para gerar o link.', true);
  }

  // 5. Download em lote organizado por pastas para o Blender
  async function startBatchDownload() {
    if (state.isDownloading) return;

    const queue = [];
    const models = Array.from(state.models.values());

    for (const m of models) {
      const folder = m.isAnimated ? 'Modelos_Animados' : m.category;
      
      if (state.selectedFormats.glb && m.glb) {
        queue.push({ url: m.glb, filename: `${m.name}.glb`, subfolder: folder });
      }
      if (state.selectedFormats.fbx && m.fbx) {
        queue.push({ url: m.fbx, filename: `${m.name}.fbx`, subfolder: folder });
      }
    }

    if (queue.length === 0) {
      alert('Nenhum arquivo .GLB ou .FBX disponível para download ainda.\nClique em "📑 Varrer Páginas" e abra os modelos para capturar todos os arquivos do Blender!');
      return;
    }

    state.isDownloading = true;
    const progressBox = document.getElementById('meshy-progress-box');
    if (progressBox) progressBox.style.display = 'block';

    const btnAll = document.getElementById('meshy-btn-download-all');
    if (btnAll) {
      btnAll.disabled = true;
      btnAll.innerText = `⏳ Baixando ${queue.length} arquivos para o Blender...`;
    }

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_BATCH',
      payload: queue
    }, (res) => {
      state.isDownloading = false;
      if (btnAll) {
        btnAll.disabled = false;
        btnAll.innerText = `⚡ Baixar Tudo para o Blender (${state.models.size} modelos)`;
      }
      showToast(`✅ Downloads concluídos! Arquivos salvos na pasta 'Downloads/Meshy_Blender/'`);
      setTimeout(() => {
        if (progressBox) progressBox.style.display = 'none';
      }, 5000);
    });
  }

  function updateProgressBar(current, total, filename) {
    const pct = Math.round((current / total) * 100);
    const fill = document.getElementById('meshy-progress-fill');
    const text = document.getElementById('meshy-progress-text');
    const pctEl = document.getElementById('meshy-progress-pct');
    const fileEl = document.getElementById('meshy-progress-file');

    if (fill) fill.style.width = `${pct}%`;
    if (text) text.innerText = `Baixando para o Blender: ${current} de ${total}`;
    if (pctEl) pctEl.innerText = `${pct}%`;
    if (fileEl) fileEl.innerText = filename || '';
  }

  function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = `meshy-toast ${isError ? 'error' : 'success'}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  // 6. Injetar badges nos cards da galeria do Meshy
  function injectCardButtons() {
    const cards = document.querySelectorAll('[data-testid="assets-card"]');
    cards.forEach((card, idx) => {
      if (card.querySelector('.meshy-card-dl-badge')) return;

      const taskId = card.dataset.meshyTaskId || ('card_' + idx);

      // Detectar se o card tem ícone de animação / corrida
      const isCardAnimated = Boolean(
        card.querySelector('.tabler-icon-run') || 
        card.querySelector('svg[class*="run"]') ||
        card.innerHTML.includes('tabler-icon-run') ||
        card.innerHTML.includes('animate') ||
        (state.models.get(taskId)?.isAnimated)
      );

      const badge = document.createElement('div');
      badge.className = `meshy-card-dl-badge ${isCardAnimated ? 'is-animated-badge' : ''}`;
      badge.innerHTML = `<span>⚡ ${isCardAnimated ? '🏃 DL Blender' : 'DL Blender'}</span>`;
      badge.title = isCardAnimated ? 'Baixar Modelo com Movimento/Animação (.GLB / .FBX)' : 'Baixar Modelo 3D para Blender (.GLB)';
      
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        let targetModel = state.models.get(taskId);
        if (!targetModel) {
          targetModel = Array.from(state.models.values()).find(m => taskId && m.id.includes(taskId));
        }

        if (targetModel && (targetModel.glb || targetModel.fbx)) {
          const downloadUrl = targetModel.glb || targetModel.fbx;
          const ext = targetModel.glb ? 'glb' : 'fbx';
          const subfolder = targetModel.isAnimated ? 'Modelos_Animados' : targetModel.category;
          downloadSingleFile(downloadUrl, `${targetModel.name}.${ext}`, subfolder);
        } else {
          // Clicar no card para abrir no visualizador do Meshy e capturar os links .GLB/.FBX
          card.click();
          showToast('Abrindo modelo no visualizador para capturar arquivos do Blender...', false);
        }
      });

      card.style.position = 'relative';
      card.appendChild(badge);
    });
  }

  // 7. Varrer o DOM e extrair corretamente o ID único de cada card
  function scanDOMForAssets() {
    const cards = document.querySelectorAll('[data-testid="assets-card"]');
    cards.forEach((card, idx) => {
      const img = card.querySelector('img');
      const imgSrc = (img?.src || '') + ' ' + (img?.srcset || '');

      // Extrair todos os UUIDs presentes na imagem do card
      const allUuids = [...imgSrc.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)].map(x => x[0]);
      
      // O último UUID na URL é o ID exclusivo do modelo/tarefa (evita pegar o ID da conta do usuário)
      let id = null;
      if (allUuids.length > 1) {
        id = allUuids[allUuids.length - 1];
      } else if (allUuids.length === 1) {
        id = allUuids[0];
      } else {
        id = 'card_item_' + idx;
      }

      card.dataset.meshyTaskId = id;

      // Verificar se este card é uma animação/movimento (ícone de corrida no canto)
      const isCardAnimated = Boolean(
        card.querySelector('.tabler-icon-run') || 
        card.querySelector('svg[class*="run"]') ||
        card.innerHTML.includes('tabler-icon-run') ||
        card.innerHTML.includes('animate')
      );

      // Obter nome legível
      const titleEl = card.querySelector('.truncate') || card.querySelector('span[title]') || card.querySelector('span');
      let name = titleEl?.innerText?.trim();
      if (!name || name === '90%' || name.includes('%')) {
        name = isCardAnimated ? 'Animacao_Corrida_Personagem' : ('Personagem_' + id.substring(0, 8));
      }

      const cleanName = name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 60);

      if (!state.models.has(id)) {
        state.models.set(id, {
          id,
          name: cleanName,
          thumbnail: img?.src || null,
          isAnimated: isCardAnimated,
          category: isCardAnimated ? 'Modelos_Animados' : 'Personagens_Texturizados',
          glb: null,
          fbx: null
        });
      } else {
        const ex = state.models.get(id);
        if (isCardAnimated && !ex.isAnimated) {
          ex.isAnimated = true;
          ex.category = 'Modelos_Animados';
        }
        if (img?.src && !ex.thumbnail) {
          ex.thumbnail = img.src;
        }
      }
    });

    injectCardButtons();
  }

  const observer = new MutationObserver(() => {
    scanDOMForAssets();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    createHUD();
    scanDOMForAssets();
  }, 1000);

})();
