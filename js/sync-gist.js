/* =========================================================
 * 「一句箴言」云端同步引擎 —— 基于 GitHub Gist
 * 数据存进用户私有 Gist，App 打开拉取、改动推送。
 * Token 仅存于本机 localStorage，不写进代码、不上传任何服务器。
 * ========================================================= */
(function () {
  'use strict';

  var GIST_FILENAME = 'yijuzhenyan-data.json';
  var GIST_DESC = 'yijuzhenyan-data-backup';
  var API = 'https://api.github.com';

  // 本地持久化的同步配置 key
  var K_TOKEN = 'yjzy_gist_token';
  var K_GIST = 'yjzy_gist_id';
  var K_AUTO = 'yjzy_gist_auto';
  var K_LAST = 'yjzy_gist_last';

  var Sync = {
    token: '',
    gistId: '',
    auto: true,
    lastSync: 0,
    busy: false,
    _timer: null,
    _statusCb: null, // 状态回调（UI 用）

    /* ---------- 本地配置读写 ---------- */
    init: function () {
      try {
        this.token = localStorage.getItem(K_TOKEN) || '';
        this.gistId = localStorage.getItem(K_GIST) || '';
        this.auto = localStorage.getItem(K_AUTO) !== '0';
        this.lastSync = parseInt(localStorage.getItem(K_LAST) || '0', 10) || 0;
      } catch (e) {
        this.token = '';
      }
    },
    isConnected: function () {
      return !!(this.token && this.gistId);
    },
    _saveCfg: function () {
      try {
        localStorage.setItem(K_TOKEN, this.token);
        localStorage.setItem(K_GIST, this.gistId);
        localStorage.setItem(K_AUTO, this.auto ? '1' : '0');
        localStorage.setItem(K_LAST, String(this.lastSync));
      } catch (e) {}
    },

    /* ---------- 状态广播 ---------- */
    onStatus: function (cb) { this._statusCb = cb; },
    emit: function (state) {
      // state: { type:'ok'|'err'|'info', msg:string }
      if (this._statusCb) this._statusCb(state);
    },

    /* ---------- 底层请求（CORS，Bearer） ---------- */
    _req: function (method, path, body) {
      var opts = {
        method: method,
        headers: {
          'Authorization': 'Bearer ' + this.token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      };
      if (body !== undefined) opts.body = JSON.stringify(body);
      return fetch(API + path, opts).then(function (res) {
        if (!res.ok) {
          var err = new Error('GitHub API ' + res.status);
          err.status = res.status;
          return res.text().then(function (t) { err.detail = t; throw err; });
        }
        // 204 无内容
        if (res.status === 204) return null;
        return res.json();
      });
    },

    /* ---------- 校验 token 并返回用户名 ---------- */
    verifyToken: function () {
      return this._req('GET', '/user').then(function (u) { return u.login; });
    },

    /* ---------- 开启同步：校验 + 建/取 gist ---------- */
    connect: function (token) {
      var self = this;
      this.token = (token || '').trim();
      if (!this.token) return Promise.reject(new Error('请输入 Token'));
      return this.verifyToken().then(function (login) {
        // 已有 gist 则复用，否则新建
        if (!self.gistId) {
          return self._createGist().then(function () { return login; });
        }
        return login;
      }).then(function (login) {
        self._saveCfg();
        return login;
      });
    },

    _createGist: function () {
      var self = this;
      var payload = {
        description: GIST_DESC,
        public: false,
        files: {},
      };
      payload.files[GIST_FILENAME] = { content: window.Store.exportData() };
      return this._req('POST', '/gists', payload).then(function (g) {
        self.gistId = g.id;
        self.lastSync = Date.now();
      });
    },

    /* ---------- 上传（push） ---------- */
    push: function () {
      var self = this;
      if (!this.isConnected() || this.busy) return Promise.resolve(false);
      this.busy = true;
      var payload = { files: {} };
      payload.files[GIST_FILENAME] = { content: window.Store.exportData() };
      return this._req('PATCH', '/gists/' + this.gistId, payload)
        .then(function () {
          self.lastSync = Date.now();
          self._saveCfg();
          return true;
        })
        .catch(function (e) { throw e; })
        .then(function (r) { self.busy = false; return r; }, function (e) { self.busy = false; throw e; });
    },

    /* ---------- 下载（pull）并合并 ---------- */
    pull: function () {
      var self = this;
      if (!this.isConnected() || this.busy) return Promise.resolve(false);
      this.busy = true;
      return this._req('GET', '/gists/' + this.gistId)
        .then(function (g) {
          var f = g && g.files && g.files[GIST_FILENAME];
          if (!f || !f.content) return 0;
          var remote = JSON.parse(f.content);
          var n = window.Store.mergeRemote(remote);
          self.lastSync = Date.now();
          self._saveCfg();
          return n;
        })
        .then(function (r) { self.busy = false; return r; }, function (e) { self.busy = false; throw e; });
    },

    /* ---------- 一次完整同步：先 pull 后 push ---------- */
    sync: function () {
      var self = this;
      if (!this.isConnected()) return Promise.reject(new Error('未开启同步'));
      this.emit({ type: 'info', msg: '同步中…' });
      return this.pull()
        .then(function (merged) {
          return self.push().then(function () { return merged; });
        })
        .then(function (merged) {
          self.emit({ type: 'ok', msg: '已同步' + (merged ? '（合并 ' + merged + ' 项）' : '') });
          return true;
        })
        .catch(function (e) {
          var m = (e && e.status === 403) ? '同步失败：Token 权限不足（需 gist 权限）'
            : (e && e.status === 401) ? '同步失败：Token 无效或已失效'
            : '同步失败：' + (e && e.message ? e.message : '网络错误');
          self.emit({ type: 'err', msg: m });
          return false;
        });
    },

    /* ---------- 数据变更后自动同步（debounce） ---------- */
    schedulePush: function () {
      if (!this.auto || !this.isConnected()) return;
      var self = this;
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(function () {
        self.push().then(function (ok) {
          if (ok) {
            self.emit({ type: 'ok', msg: '已自动备份' });
          }
        }).catch(function (e) {
          var m = (e && e.status === 401) ? '自动备份失败：Token 失效'
            : (e && e.status === 403) ? '自动备份失败：权限不足'
            : '自动备份失败：网络错误';
          self.emit({ type: 'err', msg: m });
        });
      }, 1500);
    },

    /* ---------- 断开 ---------- */
    disconnect: function () {
      this.token = '';
      this.gistId = '';
      this.lastSync = 0;
      try {
        localStorage.removeItem(K_TOKEN);
        localStorage.removeItem(K_GIST);
        localStorage.removeItem(K_LAST);
      } catch (e) {}
    },

    /* ---------- 设置已存在的 Gist ID（换手机恢复用） ---------- */
    setGistId: function (id) {
      this.gistId = (id || '').trim();
      this._saveCfg();
    },

    lastSyncText: function () {
      if (!this.lastSync) return '';
      var d = new Date(this.lastSync);
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) +
        ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
  };

  window.Sync = Sync;
})();
