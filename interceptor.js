// Meshy.ai Network Interceptor (runs in page MAIN world)
// Focado exclusivamente em arquivos 3D compatíveis com o Blender (.GLB e .FBX)
(function() {
  if (window.__MESHY_INTERCEPTOR_INSTALLED__) return;
  window.__MESHY_INTERCEPTOR_INSTALLED__ = true;

  window.__MESHY_DOWNLOADER_CACHE__ = new Map();

  function sanitizeModel(obj) {
    if (!obj || typeof obj !== 'object') return null;

    const id = obj.id || obj.task_id || obj.taskId || obj.uuid;
    if (!id && !obj.model_urls && !obj.glb_url && !obj.glb) return null;

    // Detectar se é uma animação/movimento para o Blender
    const rawName = obj.prompt || obj.title || obj.name || obj.task_name || (id ? 'Modelo_' + id.substring(0, 8) : 'Modelo_3D');
    const nameLower = String(rawName).toLowerCase();
    
    const isAnimated = Boolean(
      obj.phase === 'animate' || 
      obj.mode === 'animate' || 
      obj.action || 
      obj.animation_action || 
      obj.animation_id ||
      obj.retarget ||
      nameLower.includes('anim') ||
      nameLower.includes('run') ||
      nameLower.includes('running') ||
      nameLower.includes('walk') ||
      nameLower.includes('withskin')
    );

    const cleanName = String(rawName).trim().replace(/[\\/:*?"<>|]/g, '_').substring(0, 60);

    let glb = null;
    let fbx = null;
    let thumbnail = obj.thumbnail_url || obj.thumbnail || obj.image_url || null;

    // Verificar model_urls (.GLB e .FBX apenas para Blender)
    if (obj.model_urls && typeof obj.model_urls === 'object') {
      glb = obj.model_urls.glb || null;
      fbx = obj.model_urls.fbx || null;
    }

    if (!glb && obj.glb_url) glb = obj.glb_url;
    if (!glb && typeof obj.glb === 'string') glb = obj.glb;
    if (!fbx && obj.fbx_url) fbx = obj.fbx_url;
    if (!fbx && typeof obj.fbx === 'string') fbx = obj.fbx;

    if (obj.output && typeof obj.output === 'object') {
      glb = glb || obj.output.glb || null;
      fbx = fbx || obj.output.fbx || null;
      thumbnail = thumbnail || obj.output.thumbnail || null;
    }

    if (glb || fbx || id) {
      // Categorização estrita para pastas do Blender
      let category = 'Modelos_Base';
      if (isAnimated) {
        category = 'Modelos_Animados';
      } else if (obj.has_texture || obj.texture_url || (glb && glb.includes('texture')) || nameLower.includes('character') || nameLower.includes('personagem')) {
        category = 'Personagens_Texturizados';
      }

      return {
        id: id || ('model_' + Math.random().toString(36).substr(2, 9)),
        name: cleanName,
        isAnimated,
        category,
        glb,
        fbx,
        thumbnail,
        createdAt: obj.created_at || obj.createdAt || Date.now(),
        raw: obj
      };
    }

    return null;
  }

  function extractModelsFromData(data) {
    if (!data) return;
    const found = [];

    function traverse(item) {
      if (!item) return;
      if (Array.isArray(item)) {
        for (const sub of item) traverse(sub);
      } else if (typeof item === 'object') {
        const model = sanitizeModel(item);
        if (model) {
          found.push(model);
        } else {
          for (const key of Object.keys(item)) {
            if (typeof item[key] === 'object' && item[key] !== null) {
              traverse(item[key]);
            }
          }
        }
      }
    }

    traverse(data);

    if (found.length > 0) {
      for (const m of found) {
        if (!window.__MESHY_DOWNLOADER_CACHE__.has(m.id)) {
          window.__MESHY_DOWNLOADER_CACHE__.set(m.id, m);
        } else {
          const ex = window.__MESHY_DOWNLOADER_CACHE__.get(m.id);
          ex.glb = ex.glb || m.glb;
          ex.fbx = ex.fbx || m.fbx;
          ex.thumbnail = ex.thumbnail || m.thumbnail;
          if (m.isAnimated) {
            ex.isAnimated = true;
            ex.category = 'Modelos_Animados';
          }
        }
      }

      window.postMessage({
        type: 'MESHY_DOWNLOADER_MODELS_UPDATED',
        models: Array.from(window.__MESHY_DOWNLOADER_CACHE__.values())
      }, '*');
    }
  }

  // Interceptar chamadas fetch para capturar modelos 3D do Blender
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');

      if (typeof url === 'string') {
        // Capturar diretamente arquivos 3D .GLB ou .FBX
        if (url.includes('.glb') || url.includes('.fbx')) {
          const cleanUrl = url.split('?')[0];
          const filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
          const fnameLower = filename.toLowerCase();
          const isAnim = fnameLower.includes('anim') || fnameLower.includes('run') || fnameLower.includes('withskin');
          const isChar = fnameLower.includes('character') || fnameLower.includes('output') || fnameLower.includes('texture');
          const format = url.includes('.glb') ? 'glb' : 'fbx';
          
          extractModelsFromData({
            id: 'captured_' + filename,
            name: filename.replace(/\.(glb|fbx)$/i, ''),
            isAnimated: isAnim,
            category: isAnim ? 'Modelos_Animados' : (isChar ? 'Personagens_Texturizados' : 'Modelos_Base'),
            [format]: url
          });
        }
      }

      const clone = response.clone();
      const contentType = clone.headers.get('content-type') || '';
      if (contentType.includes('application/json') || (typeof url === 'string' && (url.includes('/api/') || url.includes('meshy.ai')))) {
        clone.json().then(data => {
          extractModelsFromData(data);
        }).catch(() => {});
      }
    } catch (e) {}
    return response;
  };

  // Interceptar XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._meshyUrl = url;
    return originalXhrOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const url = this._meshyUrl || '';
        if (typeof url === 'string' && (url.includes('.glb') || url.includes('.fbx'))) {
          const cleanUrl = url.split('?')[0];
          const filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
          const fnameLower = filename.toLowerCase();
          const isAnim = fnameLower.includes('anim') || fnameLower.includes('run') || fnameLower.includes('withskin');
          const isChar = fnameLower.includes('character') || fnameLower.includes('output') || fnameLower.includes('texture');
          const format = url.includes('.glb') ? 'glb' : 'fbx';

          extractModelsFromData({
            id: 'captured_' + filename,
            name: filename.replace(/\.(glb|fbx)$/i, ''),
            isAnimated: isAnim,
            category: isAnim ? 'Modelos_Animados' : (isChar ? 'Personagens_Texturizados' : 'Modelos_Base'),
            [format]: url
          });
        }

        if (this.responseType === '' || this.responseType === 'text' || this.responseType === 'json') {
          let data = this.response;
          if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
            data = JSON.parse(data);
          }
          extractModelsFromData(data);
        }
      } catch (e) {}
    });
    return originalXhrSend.apply(this, args);
  };

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'MESHY_DOWNLOADER_GET_ALL') {
      window.postMessage({
        type: 'MESHY_DOWNLOADER_MODELS_UPDATED',
        models: Array.from(window.__MESHY_DOWNLOADER_CACHE__.values())
      }, '*');
    }
  });

  console.log('[Meshy Downloader] Interceptor ativo - Focado em .GLB/.FBX para Blender.');
})();
