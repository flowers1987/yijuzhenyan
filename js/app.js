/* =========================================================
 * 「一句箴言」应用逻辑
 * ========================================================= */
(function () {
  'use strict';

  Store.load();

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    catTabs: $('catTabs'),
    card: $('card'),
    cardWrap: $('cardWrap'),
    cardCat: $('cardCat'),
    cardText: $('cardText'),
    cardDate: $('cardDate'),
    cardMenuBtn: $('cardMenuBtn'),
    emptyState: $('emptyState'),
    emptyCreateBtn: $('emptyCreateBtn'),
    stage: $('stage'),
    dots: $('dots'),
    prevBtn: $('prevBtn'),
    nextBtn: $('nextBtn'),
    brandSub: $('brandSub'),
    // cats
    catList: $('catList'),
    addCatBtn: $('addCatBtn'),
    exportBtn: $('exportBtn'),
    // edit
    editTitle: $('editTitle'),
    aphorismInput: $('aphorismInput'),
    charCount: $('charCount'),
    catPick: $('catPick'),
    cancelEditBtn: $('cancelEditBtn'),
    saveAphorismBtn: $('saveAphorismBtn'),
    // sheet
    cardSheetMask: $('cardSheetMask'),
    sheetEdit: $('sheetEdit'),
    sheetDelete: $('sheetDelete'),
    sheetCancel: $('sheetCancel'),
    // toast
    toast: $('toast'),
    // modal
    modalMask: $('modalMask'),
    modalTitle: $('modalTitle'),
    modalInput: $('modalInput'),
    modalCancel: $('modalCancel'),
    modalOk: $('modalOk'),
    // confirm
    confirmMask: $('confirmMask'),
    confirmMsg: $('confirmMsg'),
    confirmYes: $('confirmYes'),
    confirmNo: $('confirmNo'),
    // backup
    backupBtn: $('backupBtn'),
    importBtn: $('importBtn'),
    importFile: $('importFile'),
    backupMsg: $('backupMsg'),
    // sync (云端同步)
    syncState: $('syncState'),
    syncOff: $('syncOff'),
    syncOn: $('syncOn'),
    tokenInput: $('tokenInput'),
    connectBtn: $('connectBtn'),
    syncNowBtn: $('syncNowBtn'),
    disconnectBtn: $('disconnectBtn'),
    autoSyncChk: $('autoSyncChk'),
    syncMsg: $('syncMsg'),
    restoreIdInput: $('restoreIdInput'),
    restoreBtn: $('restoreBtn'),
    gistIdText: $('gistIdText'),
  };

  // ---------- 状态 ----------
  const state = {
    view: 'home',
    filter: 'all',
    index: 0,
    lastDir: 1,
    editingId: null,
    pickCat: null,
    animating: false,
    sheetAphId: null,
  };

  // ---------- 工具 ----------
  function currentList() {
    return Store.getAphorisms(state.filter);
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 1800);
  }

  // =========================================================
  //  首页：分类标签
  // =========================================================
  function renderCatTabs() {
    const cats = Store.getCategories();
    const all = [{ id: 'all', name: '全部', color: 'var(--ink-faint)' }].concat(cats);
    el.catTabs.innerHTML = '';
    all.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'cat-tab' + (state.filter === c.id ? ' active' : '');
      b.style.setProperty('--accent', c.id === 'all' ? '#8a9aa8' : c.color);
      // 让激活态用各自颜色
      if (state.filter === c.id && c.id !== 'all') {
        b.style.background = c.color;
        b.style.borderColor = 'transparent';
      }
      b.innerHTML = (c.id === 'all' ? '' : `<span class="dot" style="background:${c.color}"></span>`) + c.name;
      b.addEventListener('click', () => {
        state.filter = c.id;
        state.index = 0;
        renderCatTabs();
        renderHome(true);
      });
      el.catTabs.appendChild(b);
    });
  }

  // =========================================================
  //  首页：卡片渲染
  // =========================================================
  function renderHome(fade) {
    const list = currentList();
    // 若当前分类已被删除
    if (state.filter !== 'all' && !Store.getCategory(state.filter)) {
      state.filter = 'all';
      renderCatTabs();
    }
    if (state.index >= list.length) state.index = Math.max(0, list.length - 1);

    if (list.length === 0) {
      el.cardWrap.hidden = true;
      el.emptyState.hidden = false;
      el.dots.innerHTML = '';
      el.prevBtn.disabled = true;
      el.nextBtn.disabled = true;
      el.brandSub.textContent = '静谧 · 沉淀 · 自愈';
      return;
    }
    el.emptyState.hidden = true;
    el.cardWrap.hidden = false;

    renderCardContent();
    renderDots();
    updatePager();

    if (fade) {
      el.card.style.transition = 'none';
      el.card.style.opacity = '0';
      el.card.style.transform = 'translateY(10px)';
      void el.card.offsetWidth;
      el.card.style.transition = '';
      el.card.style.opacity = '';
      el.card.style.transform = '';
    }
  }

  function renderCardContent() {
    const list = currentList();
    const a = list[state.index];
    if (!a) return;
    const cat = Store.getCategory(a.categoryId);
    const accent = cat ? cat.color : '#8a9aa8';
    el.card.style.setProperty('--accent', accent);
    el.cardCat.textContent = cat ? cat.name : '未分类';
    el.cardText.textContent = a.text;
    el.cardDate.textContent = fmtDate(a.createdAt) + '　·　tinyfish';
  }

  function renderDots() {
    const list = currentList();
    const n = list.length;
    el.dots.innerHTML = '';
    const max = Math.min(n, 7);
    for (let i = 0; i < max; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i === state.index ? ' on' : '');
      el.dots.appendChild(d);
    }
  }

  function updatePager() {
    const list = currentList();
    const n = list.length;
    el.prevBtn.disabled = state.index <= 0;
    el.nextBtn.disabled = state.index >= n - 1;
    const cat = state.filter === 'all' ? null : Store.getCategory(state.filter);
    el.brandSub.textContent = `${cat ? cat.name + ' · ' : ''}第 ${Math.min(state.index + 1, n)} / ${n} 句`;
    // 同步 dots 高亮
    Array.from(el.dots.children).forEach((d, i) => {
      d.classList.toggle('on', i === state.index);
    });
  }

  // =========================================================
  //  翻页 / 滑动
  // =========================================================
  function navigate(dir) {
    if (state.animating) return;
    const list = currentList();
    const ni = state.index + dir;
    if (ni < 0 || ni >= list.length) {
      // 边界回弹
      bounce(dir);
      return;
    }
    state.animating = true;
    state.lastDir = dir;
    el.card.style.transition = '';
    el.card.style.opacity = '';
    el.card.style.transform = '';
    el.card.classList.add(dir > 0 ? 'swipe-out-left' : 'swipe-out-right');
    el.card.style.opacity = '0';
    setTimeout(() => {
      state.index = ni;
      swapContent(dir);
    }, 300);
  }

  function bounce(dir) {
    el.card.style.transition = 'transform 0.35s var(--ease)';
    const off = dir > 0 ? 24 : -24;
    el.card.style.transform = `translateX(${off}px)`;
    setTimeout(() => { el.card.style.transform = ''; }, 220);
  }

  function swapContent(dir) {
    const card = el.card;
    card.style.transition = 'none';
    card.classList.remove('swipe-out-left', 'swipe-out-right', 'swipe-in-left', 'swipe-in-right');
    card.style.opacity = '';
    card.style.transform = '';
    renderCardContent();
    renderDots();
    updatePager();
    card.classList.add(dir > 0 ? 'swipe-in-right' : 'swipe-in-left');
    void card.offsetWidth;
    card.style.transition = '';
    requestAnimationFrame(() => {
      card.classList.remove('swipe-in-right', 'swipe-in-left');
      state.animating = false;
    });
  }

  // 指针拖拽（鼠标 + 触摸统一）
  let drag = null;
  el.cardWrap.addEventListener('pointerdown', (e) => {
    if (state.animating) return;
    if (e.target === el.cardMenuBtn) return;
    drag = { x0: e.clientX, dx: 0 };
    el.card.style.transition = 'none';
    try { el.cardWrap.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.cardWrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dx = e.clientX - drag.x0;
    const rot = drag.dx / 30;
    const ry = drag.dx / 24;
    const scale = 1 - Math.min(Math.abs(drag.dx) / 1800, 0.06);
    el.card.style.transform = `translateX(${drag.dx}px) rotateY(${ry}deg) rotate(${rot}deg) scale(${scale})`;
    el.card.style.opacity = String(1 - Math.min(Math.abs(drag.dx) / 700, 0.35));
  });
  function endDrag(e) {
    if (!drag) return;
    const dx = drag.dx;
    drag = null;
    el.card.style.transition = '';
    if (dx <= -60) navigate(1);
    else if (dx >= 60) navigate(-1);
    else { el.card.style.transform = ''; el.card.style.opacity = ''; }
  }
  el.cardWrap.addEventListener('pointerup', endDrag);
  el.cardWrap.addEventListener('pointercancel', endDrag);

  el.prevBtn.addEventListener('click', () => navigate(-1));
  el.nextBtn.addEventListener('click', () => navigate(1));

  // 键盘（桌面预览友好）
  document.addEventListener('keydown', (e) => {
    if (state.view !== 'home') return;
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // =========================================================
  //  卡片操作菜单（编辑 / 删除）
  // =========================================================
  el.cardMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const list = currentList();
    const a = list[state.index];
    if (!a) return;
    state.sheetAphId = a.id;
    el.cardSheetMask.hidden = false;
  });
  el.sheetCancel.addEventListener('click', () => { el.cardSheetMask.hidden = true; });
  el.cardSheetMask.addEventListener('click', (e) => {
    if (e.target === el.cardSheetMask) el.cardSheetMask.hidden = true;
  });
  el.sheetEdit.addEventListener('click', () => {
    el.cardSheetMask.hidden = true;
    const a = Store.getAphorism(state.sheetAphId);
    if (a) openEdit(a.id);
  });
  el.sheetDelete.addEventListener('click', () => {
    el.cardSheetMask.hidden = true;
    const a = Store.getAphorism(state.sheetAphId);
    if (!a) return;
    confirmDialog('确定删除这句箴言吗？此操作不可撤销。', () => {
      Store.deleteAphorism(a.id);
      const list = currentList();
      if (state.index >= list.length) state.index = Math.max(0, list.length - 1);
      renderHome(true);
      toast('已删除');
    });
  });

  // =========================================================
  //  分类管理
  // =========================================================
  function renderCatList() {
    const cats = Store.getCategories();
    el.catList.innerHTML = '';
    if (cats.length === 0) {
      const li = document.createElement('li');
      li.className = 'cat-item';
      li.innerHTML = `<span class="name" style="color:var(--ink-faint)">还没有分类，先创建一个吧</span>`;
      el.catList.appendChild(li);
      return;
    }
    cats.forEach((c) => {
      const count = Store.getAphorisms(c.id).length;
      const li = document.createElement('li');
      li.className = 'cat-item';
      li.dataset.id = c.id;
      li.innerHTML = `
        <span class="drag-handle" aria-label="拖动排序">≡</span>
        <span class="swatch" style="background:${c.color}"></span>
        <span class="name">${escapeHtml(c.name)}</span>
        <span class="count">${count} 句</span>
        <button class="mini edit" data-id="${c.id}">编辑</button>
        <button class="mini del" data-id="${c.id}">删除</button>`;
      li.querySelector('.edit').addEventListener('click', () => {
        openModal('编辑分类名称', c.name, (val) => {
          if (Store.updateCategory(c.id, val)) { renderCatList(); renderCatTabs(); renderHome(true); toast('已更新'); }
        });
      });
      li.querySelector('.del').addEventListener('click', () => {
        confirmDialog(`删除「${c.name}」？该分类下的箴言也会一并删除。`, () => {
          Store.deleteCategory(c.id);
          renderCatList(); renderCatTabs(); renderHome(true); toast('已删除');
        });
      });
      el.catList.appendChild(li);
    });
  }
  el.addCatBtn.addEventListener('click', () => {
    openModal('新增分类', '', (val) => {
      const cat = Store.addCategory(val);
      if (cat) { renderCatList(); renderCatTabs(); renderHome(true); toast('已添加'); }
    });
  });

  // 分类拖拽排序（指针事件，鼠标/触摸统一）
  function getDragAfter(container, y) {
    const els = Array.from(container.querySelectorAll('.cat-item:not(.dragging)'));
    let closest = { dist: -Infinity, el: null };
    for (const elx of els) {
      const box = elx.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.dist) closest = { dist: offset, el: elx };
    }
    return closest.el;
  }

  function initCategoryDrag() {
    const list = el.catList;
    let drag = null;

    list.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const item = handle.closest('.cat-item');
      if (!item) return;
      const rect = item.getBoundingClientRect();
      const clone = item.cloneNode(true);
      clone.classList.add('cat-drag-clone');
      clone.style.position = 'fixed';
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.margin = '0';
      clone.style.zIndex = '999';
      document.body.appendChild(clone);
      item.classList.add('dragging');
      list.classList.add('reordering');
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      drag = { item, clone, grabY: e.clientY - rect.top, handle, pointerId: e.pointerId };
      e.preventDefault();
    });

    list.addEventListener('pointermove', (e) => {
      if (!drag) return;
      drag.clone.style.top = (e.clientY - drag.grabY) + 'px';
      const after = getDragAfter(list, e.clientY);
      if (after == null) list.appendChild(drag.item);
      else list.insertBefore(drag.item, after);
    });

    function endDrag() {
      if (!drag) return;
      try { drag.handle.releasePointerCapture(drag.pointerId); } catch (_) {}
      drag.clone.remove();
      drag.item.classList.remove('dragging');
      list.classList.remove('reordering');
      const ids = Array.from(list.querySelectorAll('.cat-item')).map((li) => li.dataset.id);
      Store.reorderCategories(ids);
      drag = null;
      renderCatTabs();
      renderHome(true);
    }
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);
  }

  // 导出 Word（.docx）
  el.exportBtn.addEventListener('click', () => {
    if (Store.count() === 0) { toast('还没有可导出的箴言'); return; }
    if (!window.ExportDocx || !window.ExportDocx.exportDocx) { toast('导出模块未就绪'); return; }
    const data = {
      categories: Store.getCategories(),
      aphorisms: Store.getAphorisms('all'),
    };
    window.ExportDocx.exportDocx(data);
    toast('已生成 Word 文档');
  });

  // =========================================================
  //  创建 / 编辑箴言
  // =========================================================
  function renderCatPick() {
    const cats = Store.getCategories();
    el.catPick.innerHTML = '';
    if (cats.length === 0) {
      el.catPick.innerHTML = `<span style="color:var(--ink-faint);font-size:.85rem">请先在「分类」中创建一个分类</span>`;
      return;
    }
    if (!state.pickCat || !Store.getCategory(state.pickCat)) {
      state.pickCat = cats[0].id;
    }
    cats.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'cat-chip' + (state.pickCat === c.id ? ' on' : '');
      if (state.pickCat === c.id) { b.style.background = c.color; b.style.borderColor = 'transparent'; }
      b.innerHTML = `<span class="dot" style="background:${state.pickCat === c.id ? '#fff' : c.color}"></span>${escapeHtml(c.name)}`;
      b.addEventListener('click', () => {
        state.pickCat = c.id;
        renderCatPick();
      });
      el.catPick.appendChild(b);
    });
  }

  function openEdit(id) {
    const a = Store.getAphorism(id);
    if (!a) return;
    state.editingId = id;
    state.pickCat = a.categoryId;
    el.editTitle.textContent = '编辑箴言';
    el.aphorismInput.value = a.text;
    el.charCount.textContent = a.text.length;
    renderCatPick();
    showView('edit');
  }

  el.aphorismInput.addEventListener('input', () => {
    el.charCount.textContent = el.aphorismInput.value.length;
  });
  el.cancelEditBtn.addEventListener('click', () => {
    state.editingId = null;
    showView('home');
  });
  el.saveAphorismBtn.addEventListener('click', () => {
    const text = el.aphorismInput.value.trim();
    if (!text) { toast('写点什么吧'); return; }
    if (!state.pickCat) { toast('请先选择或创建分类'); return; }
    if (state.editingId) {
      Store.updateAphorism(state.editingId, text, state.pickCat);
      toast('已保存');
    } else {
      Store.addAphorism(text, state.pickCat);
      toast('已写下');
    }
    state.editingId = null;
    el.aphorismInput.value = '';
    el.charCount.textContent = '0';
    showView('home');
  });

  el.emptyCreateBtn.addEventListener('click', () => {
    state.editingId = null;
    el.editTitle.textContent = '写成长语';
    el.aphorismInput.value = '';
    el.charCount.textContent = '0';
    renderCatPick();
    showView('edit');
  });

  // =========================================================
  //  通用 Modal（输入分类名）
  // =========================================================
  let modalCb = null;
  function openModal(title, value, cb) {
    modalCb = cb;
    el.modalTitle.textContent = title;
    el.modalInput.value = value || '';
    el.modalMask.hidden = false;
    setTimeout(() => el.modalInput.focus(), 50);
  }
  function closeModal() { el.modalMask.hidden = true; modalCb = null; }
  el.modalCancel.addEventListener('click', closeModal);
  el.modalMask.addEventListener('click', (e) => { if (e.target === el.modalMask) closeModal(); });
  el.modalOk.addEventListener('click', () => {
    const v = el.modalInput.value.trim();
    const cb = modalCb;
    closeModal();
    if (v && cb) cb(v);
  });
  el.modalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.modalOk.click();
  });

  // =========================================================
  //  二次确认弹窗（危险操作：删除）
  // =========================================================
  let confirmCb = null;
  function confirmDialog(msg, onYes) {
    confirmCb = onYes;
    el.confirmMsg.textContent = msg;
    el.confirmMask.hidden = false;
  }
  function closeConfirm() { el.confirmMask.hidden = true; confirmCb = null; }
  el.confirmNo.addEventListener('click', closeConfirm);
  el.confirmMask.addEventListener('click', (e) => { if (e.target === el.confirmMask) closeConfirm(); });
  el.confirmYes.addEventListener('click', () => {
    const cb = confirmCb;
    closeConfirm();
    if (cb) cb();
  });

  // =========================================================
  //  视图切换
  // =========================================================
  function showView(name) {
    state.view = name;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.view === name);
    });
    if (name === 'home') renderHome(true);
    if (name === 'cats') renderCatList();
    if (name === 'edit') {
      if (!state.editingId) {
        el.editTitle.textContent = '写成长语';
        el.aphorismInput.value = '';
        el.charCount.textContent = '0';
      }
      renderCatPick();
    }
  }

  document.getElementById('tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    showView(t.dataset.view);
  });

  // =========================================================
  //  辅助
  // =========================================================
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // =========================================================
  //  数据备份（本地 .json，不依赖任何云服务）
  // =========================================================
  let backupMsgTimer = null;
  let syncMsgTimer = null;
  function showBackupMsg(msg, ok) {
    el.backupMsg.textContent = msg;
    el.backupMsg.hidden = false;
    el.backupMsg.classList.toggle('err', !ok);
    clearTimeout(backupMsgTimer);
    backupMsgTimer = setTimeout(() => { el.backupMsg.hidden = true; }, 2800);
  }

  function initBackup() {
    // 导出：移动端优先系统分享面板（可转发微信/邮件），否则下载
    el.backupBtn.addEventListener('click', () => {
      if (!window.Backup) { toast('备份模块未就绪'); return; }
      if (Store.count() === 0) { toast('还没有可备份的箴言'); return; }
      window.Backup.export().then((done) => {
        if (done !== false) toast('已导出备份');
      });
    });

    // 导入：唤起文件选择
    el.importBtn.addEventListener('click', () => el.importFile.click());

    // 导入：读取并合并
    el.importFile.addEventListener('change', () => {
      const f = el.importFile.files && el.importFile.files[0];
      if (!f) return;
      window.Backup.importFile(f)
        .then((n) => {
          renderHome(true); renderCatTabs(); renderCatList();
          showBackupMsg(n ? ('已恢复 ' + n + ' 项') : '备份已是最新，无新增', true);
          toast(n ? ('已恢复 ' + n + ' 项') : '已导入');
          // 若已开启云端同步，把恢复进来的数据也推上去
          if (window.Sync && Sync.isConnected()) Sync.push().catch(() => {});
        })
        .catch((e) => {
          showBackupMsg(e && e.message ? e.message : '导入失败', false);
        })
        .then(() => { el.importFile.value = ''; });
    });
  }

  // =========================================================
  //  云端同步（GitHub Gist 私有备份）
  // =========================================================
  function renderSyncStatus(s) {
    if (!s) return;
    el.syncMsg.textContent = s.msg;
    el.syncMsg.hidden = false;
    el.syncMsg.classList.toggle('err', s.type === 'err');
    clearTimeout(syncMsgTimer);
    syncMsgTimer = setTimeout(() => { el.syncMsg.hidden = true; }, 2800);
    if (s.type === 'ok' && Sync.isConnected()) {
      el.syncState.textContent = '已开启 · 上次同步 ' + (Sync.lastSyncText() || '—');
    } else if (s.type === 'err') {
      el.syncState.textContent = s.msg;
    }
  }

  function renderSyncPanel() {
    const on = Sync.isConnected();
    el.syncOff.hidden = on;
    el.syncOn.hidden = !on;
    el.autoSyncChk.checked = Sync.auto;
    if (on) {
      el.syncState.textContent = '已开启 · 上次同步 ' + (Sync.lastSyncText() || '—');
      el.gistIdText.textContent = Sync.gistId || '—';
    } else {
      el.syncState.textContent = '未开启同步（数据仅存本机，有丢失风险）';
    }
  }

  function onConnect() {
    const t = el.tokenInput.value.trim();
    if (!t) { toast('请粘贴 GitHub Token'); return; }
    el.connectBtn.disabled = true;
    el.connectBtn.textContent = '校验中…';
    el.syncState.textContent = '正在校验 Token…';
    Sync.connect(t)
      .then(() => Sync.push())
      .then(() => {
        renderHome(true); renderCatTabs(); renderCatList();
        el.tokenInput.value = '';
        toast('云端同步已开启');
      })
      .catch((e) => {
        const m = (e && e.status === 403) ? (e.message || 'Token 缺少 gist 权限') :
          (e && e.status === 401) ? 'Token 无效或已失效' :
          (e && e.message) ? e.message : '连接失败';
        toast(m);
        el.syncState.textContent = '未开启同步：' + m;
      })
      .then(() => {
        el.connectBtn.disabled = false;
        el.connectBtn.textContent = '开启同步';
        renderSyncPanel();
      });
  }

  function onSyncNow() {
    el.syncState.textContent = '同步中…';
    Sync.push()
      .then((ok) => { if (ok) { renderHome(true); renderCatTabs(); renderCatList(); } })
      .catch(() => {});
  }

  function onDisconnect() {
    confirmDialog('断开云端同步？本机数据会保留，但之后不再自动备份到云端。', () => {
      Sync.disconnect();
      renderSyncPanel();
      toast('已断开');
    });
  }

  function onRestore() {
    const id = el.restoreIdInput.value.trim();
    if (!id) { toast('请输入备份 Gist ID'); return; }
    el.syncState.textContent = '正在从备份恢复…';
    Sync.setGistId(id);
    Sync.pull()
      .then((n) => {
        renderHome(true); renderCatTabs(); renderCatList();
        toast(n ? ('已恢复 ' + n + ' 项') : '备份为空或已是最新');
        el.restoreIdInput.value = '';
        renderSyncPanel();
      })
      .catch((e) => {
        Sync.setGistId('');
        el.syncState.textContent = (e && e.status === 404) ? 'Gist ID 不存在' : ('恢复失败：' + (e && e.message || '请检查 ID'));
        renderSyncPanel();
      });
  }

  function initSync() {
    Sync.init();
    Store.onChange = () => Sync.schedulePush();
    Sync.onStatus(renderSyncStatus);
    el.connectBtn.addEventListener('click', onConnect);
    el.syncNowBtn.addEventListener('click', onSyncNow);
    el.disconnectBtn.addEventListener('click', onDisconnect);
    el.restoreBtn.addEventListener('click', onRestore);
    el.autoSyncChk.addEventListener('change', () => {
      Sync.auto = el.autoSyncChk.checked;
      try { localStorage.setItem('yjzy_gist_auto', Sync.auto ? '1' : '0'); } catch (e) {}
      renderSyncPanel();
    });
    renderSyncPanel();
    // 启动即从云端恢复（换手机 / 重装后自动拉回数据）
    if (Sync.isConnected()) {
      el.syncState.textContent = '正在从云端恢复…';
      Sync.pull()
        .then((n) => {
          renderHome(true); renderCatTabs(); renderCatList();
          if (n) toast('已从云端恢复 ' + n + ' 项');
        })
        .catch(() => {
          el.syncState.textContent = '云端连接异常，继续使用本机数据';
        });
    }
  }

  // =========================================================
  //  初始化
  // =========================================================
  renderCatTabs();
  renderHome(false);
  initCategoryDrag();
  initBackup();
  initSync();
  // 注册 Service Worker（离线可运行）+ 自动更新机制
  if ('serviceWorker' in navigator) {
    let reloaded = false;
    // 新 SW 接管控制权时，自动刷新一次页面（保证样式立即生效）
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        // 每次启动主动检查 SW 更新（iOS PWA 不一定自动检查）
        reg.update().catch(() => {});
        // 发现新版本安装就绪时提示用户
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              toast && toast('新版本已就绪，稍后自动生效');
            }
          });
        });
      })
      .catch(() => {});
  }
})();
