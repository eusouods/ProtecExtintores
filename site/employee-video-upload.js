/* Peças e evidências de vídeo por extintor para a área técnica. */
(() => {
  const allParts = ['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];
  const videoParts = new Set(allParts);
  const maxBytes = 50 * 1024 * 1024;

  function groups(items) {
    const grouped = new Map();
    (items || []).forEach((item, index) => {
      const type = item.type || 'Extintor';
      const kg = item.kg || '';
      const key = `${type.toLowerCase()}|${kg}`;
      if (!grouped.has(key)) grouped.set(key, {type, kg, items: [], indexes: []});
      grouped.get(key).items.push(item);
      grouped.get(key).indexes.push(index);
    });
    return [...grouped.values()];
  }

  function mimeFor(file) {
    if (file.type?.startsWith('video/')) return file.type;
    const extension = file.name.split('.').pop().toLowerCase();
    return ({mp4:'video/mp4',m4v:'video/x-m4v',mov:'video/quicktime',webm:'video/webm','3gp':'video/3gpp','3g2':'video/3gpp2'})[extension] || '';
  }

  function readDuration(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      let settled = false;
      const finish = (error, duration) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute('src');
        video.load();
        error ? reject(error) : resolve(duration);
      };
      const timeout = setTimeout(() => finish(new Error('Não foi possível ler a duração. Escolha um MP4 ou MOV salvo no aparelho.')), 15000);
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = Number(video.duration);
        if (!Number.isFinite(duration) || duration <= 0) finish(new Error('Não foi possível ler a duração deste vídeo. Escolha outro arquivo.'));
        else finish(null, duration);
      };
      video.onerror = () => finish(new Error('Este navegador não conseguiu abrir o vídeo. Escolha um MP4 ou MOV.'));
      video.src = objectUrl;
    });
  }

  async function uploadVideo(serviceId, itemIndex, part, file, duration) {
    const params = new URLSearchParams({serviceId, itemIndex:String(itemIndex), part});
    const token = localStorage.getItem(window.API_TOKEN_KEY || 'protecextintores_session');
    const base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : window.PROTEC_API_BASE_URL;
    const response = await fetch(`${base}/api/employee/media?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token || ''}`,
        'Content-Type': mimeFor(file),
        'X-Video-Duration': String(duration)
      },
      body: file
    });
    const data = await window.apiJson(response);
    if (!response.ok) throw new Error(data.error || 'Não foi possível enviar o vídeo.');
    return data.media;
  }

  window.employeeNote = async function(serviceId, groupIndex) {
    try {
      const response = await window.apiCall('/api/employee/services');
      const payload = await window.apiJson(response);
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o serviço.');
      for(const part of payload.partOptions || []){if(!allParts.includes(part))allParts.push(part);videoParts.add(part)}
      const service = (payload.services || []).find(item => item.id === serviceId);
      const group = service && groups(service.items)[groupIndex];
      if (!group) throw new Error('Este grupo de extintores não está disponível. Atualize a página e tente novamente.');

      const selectedParts = new Map(group.items.map((item, position) => [group.indexes[position], new Set(item.replacedParts || [])]));
      const selectedFiles = new Map();
      const durationByFile = new Map();
      const slotHostId = 'employeeReplacementVideoSlots';
      const slotKey = (itemIndex, part) => `${itemIndex}::${part}`;

      const pieceRows = group.items.map((item, position) => {
        const itemIndex = group.indexes[position];
        const serial = item.serial ? ` · ${item.serial}` : '';
        const capacity = item.kg ? ` · ${item.kg} kg` : '';
        const labels = allParts.map(part => `<label class="employee-part-checkbox"><input type="checkbox" data-item-index="${itemIndex}" data-part="${esc(part)}" ${selectedParts.get(itemIndex).has(part) ? 'checked' : ''}><span>${esc(part)}</span></label>`).join('');
        return `<fieldset class="employee-item-parts"><legend>Extintor ${position + 1}${esc(serial)}${esc(capacity)}</legend><div class="employee-part-checkboxes">${labels}</div></fieldset>`;
      }).join('');

      const body = `<p class="helper">Marque as peças em cada extintor. Para cada peça substituído, envie um vídeo individual de até 60 segundos e 50 MB. Filme apenas o equipamento e a área necessária.</p><div class="form-field"><label for="employeeTechnicalNotes">Observação técnica</label><textarea id="employeeTechnicalNotes" name="notes" rows="4">${esc(group.items.map(item => item.notes || '').filter(Boolean).join('\n'))}</textarea></div><section class="employee-parts-section"><h3>Peças por extintor</h3>${pieceRows}</section><section class="replacement-video-section"><h3>Vídeos de cada peça trocada</h3><p class="helper">Marque as peças primeiro; cada substituição marcada terá seu próprio campo de vídeo.</p><div id="${slotHostId}"></div></section>`;

      window.openModal('Observações, peças e vídeos', body, async formData => {
        const notes = String(formData.get('notes') || '');
        const videoFiles = [];
        for (const itemIndex of group.indexes) {
          for (const part of videoParts) {
            if (!selectedParts.get(itemIndex)?.has(part)) continue;
            const file = selectedFiles.get(slotKey(itemIndex, part));
            if (file?.size) videoFiles.push({file, part, itemIndex});
          }
        }

        for (const itemIndex of group.indexes) {
          const pieces = selectedParts.get(itemIndex) || new Set();
          for (const part of videoParts) {
            if (!pieces.has(part)) continue;
            const item = group.items[group.indexes.indexOf(itemIndex)];
            const selected = videoFiles.find(video => video.part === part && video.itemIndex === itemIndex);
            if (!selected && !item.replacementMedia?.[part]?.url) {
              window.toast?.(`Escolha um vídeo para cada ${part.toLowerCase()} substituído.`);
              return false;
            }
            if (selected && selected.file.size > maxBytes) {
              window.toast?.('Cada vídeo pode ter no máximo 50 MB.');
              return false;
            }
            if (selected && !mimeFor(selected.file)) {
              window.toast?.('Formato inválido. Escolha MP4, MOV, WebM ou 3GP.');
              return false;
            }
            if (selected && !durationByFile.has(selected.file)) {
              window.toast?.('Aguarde a verificação da duração do vídeo e tente novamente.');
              return false;
            }
          }
        }

        for (let position = 0; !service.employeeCompletedAt && position < group.indexes.length; position++) {
          const itemIndex = group.indexes[position];
          const item = group.items[position];
          const request = await window.apiCall('/api/employee/status', 'POST', {
            serviceId,
            itemIndex,
            status: item.status || 'Recebido',
            notes,
            parts: [...(selectedParts.get(itemIndex) || [])]
          });
          const data = await window.apiJson(request);
          if (!request.ok) throw new Error(data.error || 'Não foi possível salvar as peças.');
        }

        for (const selected of videoFiles) {
          const media = await uploadVideo(serviceId, selected.itemIndex, selected.part, selected.file, durationByFile.get(selected.file));
          const position = group.indexes.indexOf(selected.itemIndex);
          group.items[position].replacementMedia = {...(group.items[position].replacementMedia || {}), [selected.part]:media};
        }
        group.items.forEach((item, position) => {
          item.notes = notes;
          item.replacedParts = [...(selectedParts.get(group.indexes[position]) || [])];
        });
        await window.refreshEmployeePortal?.();
        window.toast?.('Peças e vídeos individuais salvos.');
      });

      if(service.employeeCompletedAt){document.querySelectorAll('#editForm .employee-part-checkbox input,#employeeTechnicalNotes').forEach(input=>input.disabled=true);}
      const slotHost = document.getElementById(slotHostId);
      const renderVideoSlots = () => {
        if (!slotHost) return;
        slotHost.querySelectorAll('[data-replacement-video]').forEach(input => {
          const file = input.files?.[0];
          if (file) selectedFiles.set(slotKey(Number(input.dataset.itemIndex), input.dataset.part), file);
        });
        const rows = [];
        group.items.forEach((item, position) => {
          const itemIndex = group.indexes[position];
          for (const part of videoParts) {
            if (!selectedParts.get(itemIndex)?.has(part)) continue;
            const key = slotKey(itemIndex, part);
            const existing = item.replacementMedia?.[part];
            const inputId = `replacement-video-${position}-${allParts.indexOf(part)}`;
            const label = `${part} · ${item.serial ? 'extintor ' + item.serial : 'extintor ' + (position + 1)}`;
            rows.push(`<div class="replacement-video-slot"><label for="${inputId}"><b>${esc(label)}</b><small>Vídeo individual com até 60 segundos e 50 MB.</small></label>${existing?.url ? `<div class="saved-video"><small>Vídeo registrado · ${Math.ceil(Number(existing.durationSeconds)||0)} s</small><button type="button" class="btn btn-soft btn-small" data-load-private-video data-url="${esc(existing.url)}">Carregar vídeo para assistir</button><video controls playsinline preload="none" data-media-player hidden></video></div>` : ''}<input id="${inputId}" name="${inputId}" type="file" accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/3gpp2,video/x-m4v" data-replacement-video data-part="${esc(part)}" data-item-index="${itemIndex}" data-hint="${inputId}-hint"><small id="${inputId}-hint" class="replacement-video-hint">${existing?.url ? 'Selecione outro vídeo apenas para substituir o atual.' : 'Vídeo obrigatório para esta peça.'}</small></div>`);
          }
        });
        slotHost.innerHTML = rows.join('') || '<p class="helper">Marque uma peça para adicionar o vídeo correspondente.</p>';
        slotHost.querySelectorAll('[data-replacement-video]').forEach(input => {
          const key = slotKey(Number(input.dataset.itemIndex), input.dataset.part);
          const retainedFile = selectedFiles.get(key);
          if (retainedFile) {
            try {
              const transfer = new DataTransfer();
              transfer.items.add(retainedFile);
              input.files = transfer.files;
            } catch {}
            const duration = durationByFile.get(retainedFile);
            const hint = document.getElementById(input.dataset.hint);
            if (duration && hint) hint.textContent = `Vídeo selecionado: ${retainedFile.name} · ${Math.ceil(duration)} s`;
          }
          input.addEventListener('change', async () => {
            const file = input.files?.[0];
            const hint = document.getElementById(input.dataset.hint);
            if (!file) return;
            selectedFiles.set(key, file);
            durationByFile.delete(file);
            if (file.size > maxBytes) {
              input.value = '';
              selectedFiles.delete(key);
              if (hint) hint.textContent = 'Arquivo acima de 50 MB. Grave em resolução menor ou escolha um vídeo mais leve.';
              return;
            }
            if (!mimeFor(file)) {
              input.value = '';
              selectedFiles.delete(key);
              if (hint) hint.textContent = 'Formato não aceito. Use MP4, MOV, WebM ou 3GP.';
              return;
            }
            if (hint) hint.textContent = 'Verificando duração…';
            try {
              const duration = await readDuration(file);
              if (duration > 60) {
                input.value = '';
                selectedFiles.delete(key);
                if (hint) hint.textContent = 'O vídeo tem mais de 60 segundos. Escolha um clipe mais curto.';
                return;
              }
              durationByFile.set(file, duration);
              if (hint) hint.textContent = `Vídeo selecionado: ${file.name} · ${Math.ceil(duration)} s`;
            } catch (error) {
              input.value = '';
              selectedFiles.delete(key);
              if (hint) hint.textContent = error.message;
            }
          });
        });
        slotHost.querySelectorAll('[data-load-private-video]').forEach(button => button.addEventListener('click', async () => {
          const player = button.parentElement.querySelector('[data-media-player]');
          button.disabled = true;
          button.textContent = 'Carregando vídeo…';
          try {
            const token = localStorage.getItem(window.API_TOKEN_KEY || 'protecextintores_session');
            const mediaResponse = await fetch(button.dataset.url, {headers:{Authorization:`Bearer ${token || ''}`}});
            if (!mediaResponse.ok) throw new Error(mediaResponse.status === 403 ? 'Sua conta não tem acesso a este vídeo.' : 'Não foi possível carregar o vídeo.');
            const objectUrl = URL.createObjectURL(await mediaResponse.blob());
            player.src = objectUrl;
            player.hidden = false;
            button.textContent = 'Vídeo carregado';
          } catch (error) {
            button.textContent = error.message || 'Falha ao carregar vídeo';
          } finally {
            button.disabled = false;
          }
        }));
      };

      document.querySelectorAll(`#editForm [data-item-index][data-part]:not([data-replacement-video])`).forEach(input => input.addEventListener('change', () => {
        const itemIndex = Number(input.dataset.itemIndex);
        const pieces = selectedParts.get(itemIndex) || new Set();
        input.checked ? pieces.add(input.dataset.part) : pieces.delete(input.dataset.part);
        selectedParts.set(itemIndex, pieces);
        renderVideoSlots();
      }));
      renderVideoSlots();
    } catch (error) {
      window.toast?.(error.message || 'Não foi possível abrir observações e peças.');
    }
  };
})();
