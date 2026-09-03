/* =========================================================
 * 「一句箴言」云端同步（GitHub Gist 私有备份）
 * - 数据仅存于你自己的 GitHub 私有 Gist，不经过任何第三方服务器。
 * - Token 仅存本机 localStorage，不上传。
 * - 需要带 gist 权限的 GitHub Personal Access Token（classic）。
 * ========================================================= */
(function () {
  'use strict';

  const API = 'https://api.github.com/gists';
  const FILE = 'yijuzhenyan-backup.json';
  const K_TOKEN = 'yjzy_gist_token';
  const K_GIST = 'yjzy_gist_id';
  const K_LAST = 'yjzy_gist_last';
  const K_AUTO = 'yjzy_gist_auto';

  const Sync = {
    token: '',
    gistId: '',
    last: 0,
    auto: true,
    _timer: null,
    _statusFn: null,

    init() {
      try {
        this.token = localStorage.getItem(K_TOKEN) || '';
        this.gistId = localStorage.getItem(K_GIST) || '';
        this.last = parseInt(localStorage.getItem(K_LAST) || '0', 10) || 0;
        this.auto = localStorage.getItem(K_AUTO) !== '0';
      } catch (e) { /* 忽略隐私模式异常 */ }
    },

    isConnected() { return !!this.token; },

    onStatus(fn) { this._statusFn = fn; },
    _status(msg, type) { if (this._statusFn) this._statusFn({ msg, type }); },

    _headers() {
      return {
        Authorization: 'Bearer ' + this.token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      };
    },

    // 校验 Token：直接尝试真正的 Gist 写操作来验证「token 有效 + 含 gist 权限」，
    // 不再依赖 /user 端点（部分网络会拦截 /user 但放行 /gists）。
    // 同时区分「GitHub 说密码错（真·token 无效）」与「被网络/代理拦截（proxy 401）」。
    async connect(token) {
      token = (token || '').trim();
      if (!token) throw { status: 400, message: '请粘贴 GitHub Token' };
      this.token = token;
      let probe, bodyText = '';
      try {
        probe = await fetch(API, {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify({ description: 'yjzy-connect-probe', public: false, files: { 'probe.txt': { content: 'ok' } } }),
        });
        bodyText = await probe.text().catch(() => '');
      } catch (netErr) {
        // fetch 抛错 = 网络层不可达（连不上 api.github.com）
        throw { status: 0, message: '无法连接 api.github.com：你的网络/代理可能屏蔽了该地址，请换网络后重试。' };
      }
      if (probe.status === 401) {
        // 区分 GitHub 的「Bad credentials」与代理返回的 401
        if (!/bad credentials/i.test(bodyText)) {
          throw { status: 0, message: '连接被网络/代理拦截（返回 401），不是 Token 问题。请换网络或检查代理设置。' };
        }
        throw { status: 401, message: 'Token 无效或已失效' };
      }
      if (probe.status === 403) {
        throw { status: 403, message: 'Token 缺少 gist 权限，请重新生成（勾选 gist）' };
      }
      if (!probe.ok) {
        throw { status: probe.status, message: '校验失败（HTTP ' + probe.status + '）' };
      }
      // 校验通过：清理探测用的临时 Gist
      try {
        const pj = JSON.parse(bodyText);
        if (pj && pj.id) await fetch(API + '/' + pj.id, { method: 'DELETE', headers: this._headers() }).catch(() => {});
      } catch (e) { /* 忽略清理失败 */ }
      try { localStorage.setItem(K_TOKEN, token); } catch (e) {}
      this._status('已连接，正在首次同步…', 'info');
      return true;
    },

    disconnect() {
      this.token = '';
      try {
        localStorage.removeItem(K_TOKEN);
        localStorage.removeItem(K_GIST);
      } catch (e) {}
      this._status('已断开云端同步', 'info');
    },

    setGistId(id) {
      this.gistId = id || '';
      try { if (id) localStorage.setItem(K_GIST, id); else localStorage.removeItem(K_GIST); } catch (e) {}
    },

    lastSyncText() {
      if (!this.last) return '';
      const d = new Date(this.last);
      const p = (n) => (n < 10 ? '0' + n : '' + n);
      return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },

    _payload() {
      const wrapped = Store.exportData(); // {version, updatedAt, data:{categories,aphorisms}}
      return JSON.stringify({
        description: '一句箴言 私有云端备份',
        public: false,
        files: { [FILE]: { content: wrapped } },
      });
    },

    // 推送本机数据到 Gist（首次创建，之后更新）
    async push() {
      if (!this.isConnected()) return false;
      const body = this._payload();
      const url = this.gistId ? API + '/' + this.gistId : API;
      const method = this.gistId ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: this._headers(), body });
      if (r.status === 401) throw { status: 401, message: 'Token 已失效，请重新连接' };
      if (r.status === 403) throw { status: 403, message: '无 gist 写权限，请重新生成 Token（勾选 gist）' };
      if (!r.ok) throw { status: r.status, message: '同步失败（HTTP ' + r.status + '）' };
      const j = await r.json();
      this.setGistId(j.id);
      this.last = Date.now();
      try { localStorage.setItem(K_LAST, String(this.last)); } catch (e) {}
      this._status('已同步到云端 · ' + this.lastSyncText(), 'ok');
      return true;
    },

    // 从 Gist 拉取并合并（按 id 去重，本地原有数据不覆盖丢失）
    async pull() {
      if (!this.isConnected()) return 0;
      if (!this.gistId) return 0;
      const r = await fetch(API + '/' + this.gistId, { headers: this._headers() });
      if (r.status === 404) throw { status: 404, message: '该 Gist ID 不存在' };
      if (r.status === 401) throw { status: 401, message: 'Token 已失效' };
      if (!r.ok) throw { status: r.status, message: '拉取失败（HTTP ' + r.status + '）' };
      const j = await r.json();
      const f = j.files && j.files[FILE];
      if (!f || !f.content) return 0;
      let remote;
      try { remote = JSON.parse(f.content); } catch (e) { throw { status: 0, message: '备份内容损坏，无法解析' }; }
      // 兼容两种结构：{version,updatedAt,data} 或裸 {categories,aphorisms}
      const payload = remote && remote.data ? remote : { data: remote };
      const added = Store.mergeRemote(payload);
      this.last = Date.now();
      try { localStorage.setItem(K_LAST, String(this.last)); } catch (e) {}
      this._status(added ? ('已从云端恢复 ' + added + ' 项') : '已是最新，无需恢复', 'ok');
      return added;
    },

    // 数据变动后防抖自动同步（1.5s）
    schedulePush() {
      if (!this.auto || !this.isConnected()) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this.push().catch((e) => this._status((e && e.message) || '同步失败', 'err'));
      }, 1500);
    },
  };

  window.Sync = Sync;
})();
