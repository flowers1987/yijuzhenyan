/* =========================================================
 * 「一句箴言」数据层
 * 使用 localStorage 持久化，无后端依赖，纯前端可运行。
 * ========================================================= */

const STORE_KEY = 'yiju_zhenyan_v1';

// 莫兰迪低饱和配色（每个分类一种沉静色调）
const MORANDI = [
  '#8a9aa8', // 雾蓝
  '#b9989a', // 灰玫
  '#9aab94', // 鼠尾草绿
  '#b3a486', // 燕麦
  '#9b94ab', // 烟紫
  '#a8a09a', // 暖灰
];

// 默认三大核心分类
const DEFAULT_CATEGORIES = [
  { id: 'cat-career', name: '事业', color: MORANDI[0] },
  { id: 'cat-love', name: '亲密关系', color: MORANDI[1] },
  { id: 'cat-health', name: '健康', color: MORANDI[2] },
];

// 首次启动的示例箴言（治愈短句，便于即时体验）
const SEED_APHORISMS = [
  { text: '不必急于求成，时间会把认真的人，带到该去的地方。', categoryId: 'cat-career' },
  { text: '真正的稳定，是你随时能重新开始的能力。', categoryId: 'cat-career' },
  { text: '爱不是彼此凝视，而是一起望向同一个方向。', categoryId: 'cat-love' },
  { text: '最好的关系，是彼此都能安心做自己。', categoryId: 'cat-love' },
  { text: '身体是灵魂的圣殿，善待它，它自会回以温柔。', categoryId: 'cat-health' },
  { text: '好好吃饭，好好睡觉，便是普通人最顶级的养生。', categoryId: 'cat-health' },
];

function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function defaultState() {
  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    aphorisms: SEED_APHORISMS.map((a) => ({
      id: uid(),
      text: a.text,
      categoryId: a.categoryId,
      createdAt: Date.now(),
    })),
  };
}

const Store = {
  data: null,
  onChange: null, // 数据变更钩子（同步模块挂载点）

  _changed() {
    this.save();
    if (typeof this.onChange === 'function') {
      try { this.onChange(); } catch (e) { /* 忽略钩子异常 */ }
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      this.data = raw ? JSON.parse(raw) : defaultState();
    } catch (e) {
      this.data = defaultState();
    }
    // 容错：确保字段存在
    if (!this.data.categories) this.data.categories = [];
    if (!this.data.aphorisms) this.data.aphorisms = [];
    if (!this.data.categories.length && !this.data.aphorisms.length) {
      this.data = defaultState();
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('保存失败', e);
    }
  },

  // ---- 分类 ----
  getCategories() {
    return this.data.categories.slice();
  },

  getCategory(id) {
    return this.data.categories.find((c) => c.id === id) || null;
  },

  addCategory(name) {
    name = (name || '').trim();
    if (!name) return null;
    const color = MORANDI[this.data.categories.length % MORANDI.length];
    const cat = { id: uid(), name, color };
    this.data.categories.push(cat);
    this._changed();
    return cat;
  },

  updateCategory(id, name) {
    const cat = this.getCategory(id);
    if (!cat) return false;
    name = (name || '').trim();
    if (!name) return false;
    cat.name = name;
    this._changed();
    return true;
  },

  deleteCategory(id) {
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.data.categories.splice(idx, 1);
    // 同时移除该分类下的箴言
    this.data.aphorisms = this.data.aphorisms.filter((a) => a.categoryId !== id);
    this._changed();
    return true;
  },

  // 按给定 id 顺序重排分类（拖拽排序后持久化）
  reorderCategories(orderedIds) {
    if (!Array.isArray(orderedIds)) return false;
    const map = new Map(this.data.categories.map((c) => [c.id, c]));
    const next = [];
    orderedIds.forEach((id) => {
      const c = map.get(id);
      if (c) { next.push(c); map.delete(id); }
    });
    // 兜底：保留未出现在 orderedIds 中的分类（理论上不应发生）
    map.forEach((c) => next.push(c));
    this.data.categories = next;
    this._changed();
    return true;
  },

  // ---- 箴言 ----
  getAphorisms(categoryId) {
    let list = this.data.aphorisms.slice();
    if (categoryId && categoryId !== 'all') {
      list = list.filter((a) => a.categoryId === categoryId);
    }
    // 按创建时间倒序（最新在前）
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  },

  getAphorism(id) {
    return this.data.aphorisms.find((a) => a.id === id) || null;
  },

  addAphorism(text, categoryId) {
    text = (text || '').trim();
    if (!text) return null;
    const a = { id: uid(), text, categoryId, createdAt: Date.now() };
    this.data.aphorisms.push(a);
    this._changed();
    return a;
  },

  updateAphorism(id, text, categoryId) {
    const a = this.getAphorism(id);
    if (!a) return false;
    text = (text || '').trim();
    if (!text) return false;
    a.text = text;
    if (categoryId) a.categoryId = categoryId;
    this._changed();
    return true;
  },

  deleteAphorism(id) {
    const idx = this.data.aphorisms.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.data.aphorisms.splice(idx, 1);
    this._changed();
    return true;
  },

  count() {
    return this.data.aphorisms.length;
  },

  // 导出为 JSON 字符串（用于云端同步 / 备份文件）
  exportData() {
    return JSON.stringify({ version: 1, updatedAt: Date.now(), data: this.data });
  },

  // 从远程对象合并数据（按 id 去重合并，避免互相覆盖丢失）
  // remote: { version, updatedAt, data: { categories, aphorisms } }
  // 返回合并进来的条目数
  mergeRemote(remote) {
    if (!remote || !remote.data) return 0;
    const rd = remote.data;
    const catMap = new Map(this.data.categories.map((c) => [c.id, c]));
    (rd.categories || []).forEach((c) => { if (c && c.id) catMap.set(c.id, c); });
    const aphMap = new Map(this.data.aphorisms.map((a) => [a.id, a]));
    const added = [];
    (rd.aphorisms || []).forEach((a) => {
      if (a && a.id) {
        if (!aphMap.has(a.id)) added.push(a.id);
        aphMap.set(a.id, a);
      }
    });
    this.data.categories = Array.from(catMap.values());
    this.data.aphorisms = Array.from(aphMap.values());
    this.save();
    return added.length;
  },
};

window.Store = Store;
