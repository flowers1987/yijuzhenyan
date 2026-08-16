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
    const rot = drag.dx / 36;
    el.card.style.transform = `translateX(${drag.dx}px) rotate(${rot}deg)`;
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
    el.editTitle.textContent = '写一句箴言';
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
        el.editTitle.textContent = '写一句箴言';
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
  //  初始化
  // =========================================================
  renderCatTabs();
  renderHome(false);
  initCategoryDrag();
  // 注册 Service Worker（离线可运行）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
