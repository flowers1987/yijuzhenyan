/* =========================================================
 * 「一句箴言」本地数据备份 / 恢复
 * 不依赖任何云服务：导出 .json 存到本机 / 微信 / 邮件，
 * 换手机或重装主屏时再导入即可恢复，零外部依赖。
 * ========================================================= */
(function () {
  'use strict';

  function fmtStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  const Backup = {
    // 生成备份 JSON 字符串
    toJSON: function () {
      return window.Store.exportData();
    },

    // 导出为文件：优先系统分享面板（可直接转发到微信/邮件），否则下载
    export: function () {
      const json = this.toJSON();
      const name = `一句箴言-备份-${fmtStamp()}.json`;
      const blob = new Blob([json], { type: 'application/json' });
      const file = new File([blob], name, { type: 'application/json' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: '一句箴言备份', text: '我的箴言数据备份' })
          .then(function () { return true; })
          .catch(function () { return false; }); // 用户取消
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return Promise.resolve(true);
    },

    // 从文件导入并合并（按 id 去重，远程没有的本地条目保留）
    // resolve: 合并进来的新增条目数（0 表示已是最新 / 备份为空）
    importFile: function (file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const obj = JSON.parse(reader.result);
            if (!obj || !obj.data ||
                !Array.isArray(obj.data.categories) ||
                !Array.isArray(obj.data.aphorisms)) {
              throw new Error('备份文件格式不正确');
            }
            const added = window.Store.mergeRemote(obj);
            resolve(added);
          } catch (e) {
            reject(e instanceof Error ? e : new Error('导入失败：' + e));
          }
        };
        reader.onerror = function () { reject(new Error('读取文件失败')); };
        reader.readAsText(file);
      });
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Backup;
  if (typeof window !== 'undefined') window.Backup = Backup;
})();
