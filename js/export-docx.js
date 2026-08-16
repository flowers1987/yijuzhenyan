/* =========================================================
 * 「一句箴言」数据导出 → Word (.docx)
 * 纯前端、零依赖、可离线：手写 OOXML + ZIP(Stored)。
 * 移动端优先调用系统分享面板（可直接转发到微信三方应用）。
 * ========================================================= */
(function () {
  'use strict';

  // ---------- 工具 ----------
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    }[m]));
  }

  // ---------- CRC32 ----------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ---------- ZIP (Stored, 无压缩) ----------
  function makeZip(files) {
    const enc = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const content = f.data;
      const crc = crc32(content);
      const lh = [];
      const u32 = (v) => lh.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
      const u16 = (v) => lh.push(v & 0xff, (v >>> 8) & 0xff);
      u32(0x04034b50); u16(20); u16(0); u16(0); u16(0); u16(0);
      u32(crc); u32(content.length); u32(content.length);
      u16(name.length); u16(0);
      for (const b of name) lh.push(b);
      for (const b of content) lh.push(b);
      const lhBytes = Uint8Array.from(lh);

      const ch = [];
      const cu32 = (v) => ch.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
      const cu16 = (v) => ch.push(v & 0xff, (v >>> 8) & 0xff);
      cu32(0x02014b50); cu16(20); cu16(20); cu16(0); cu16(0); cu16(0); cu16(0);
      cu32(crc); cu32(content.length); cu32(content.length);
      cu16(name.length); cu16(0); cu16(0); cu16(0); cu16(0); cu32(0); cu32(offset);
      for (const b of name) ch.push(b);
      const chBytes = Uint8Array.from(ch);

      locals.push(lhBytes);
      centrals.push(chBytes);
      offset += lhBytes.length;
    }

    const cdStart = offset;
    let cdSize = 0;
    for (const c of centrals) cdSize += c.length;
    const eo = [];
    const eu32 = (v) => eo.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
    const eu16 = (v) => eo.push(v & 0xff, (v >>> 8) & 0xff);
    eu32(0x06054b50); eu16(0); eu16(0); eu16(files.length); eu16(files.length); eu32(cdSize); eu32(cdStart); eu16(0);
    const eoBytes = Uint8Array.from(eo);

    const out = new Uint8Array(offset + cdSize + eoBytes.length);
    let p = 0;
    for (const l of locals) { out.set(l, p); p += l.length; }
    for (const c of centrals) { out.set(c, p); p += c.length; }
    out.set(eoBytes, p);
    return out;
  }

  // ---------- OOXML 片段 ----------
  function p(styleId, runs) {
    const list = typeof runs === 'string' ? [runs] : runs;
    let rxml = '';
    for (const t of list) {
      const txt = typeof t === 'string' ? t : t.text;
      const rpr = (typeof t === 'object' && t.rpr) ? `<w:rPr>${t.rpr}</w:rPr>` : '';
      rxml += `<w:r>${rpr}<w:t xml:space="preserve">${esc(txt)}</w:t></w:r>`;
    }
    const ppr = styleId ? `<w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>` : '';
    return `<w:p>${ppr}${rxml}</w:p>`;
  }

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="宋体"/><w:sz w:val="36"/><w:color w:val="3A352F"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="280"/></w:pPr><w:rPr><w:sz w:val="20"/><w:color w:val="8A9AA8"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="300" w:after="140"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="D8D0C4"/></w:pBdr></w:pPr><w:rPr><w:rFonts w:eastAsia="宋体"/><w:sz w:val="26"/><w:b/><w:color w:val="3A352F"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:pPr><w:ind w:left="360" w:right="200"/><w:spacing w:after="60"/></w:pPr><w:rPr><w:rFonts w:ascii="KaiTi" w:hAnsi="KaiTi" w:eastAsia="楷体"/><w:sz w:val="24"/><w:color w:val="3A352F"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Muted"><w:name w:val="Muted"/><w:pPr><w:jc w:val="right"/><w:spacing w:after="220"/></w:pPr><w:rPr><w:sz w:val="18"/><w:color w:val="A99F92"/></w:rPr></w:style>
</w:styles>`;

  // ---------- 组装文档 ----------
  function buildDocxBytes(data) {
    const enc = new TextEncoder();
    const now = new Date();
    const ds = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    let body = '';
    body += p('Title', '一句箴言 · 我的箴言集');
    body += p('Subtitle', `导出日期：${ds}　|　${data.aphorisms.length} 句箴言　|　${data.categories.length} 个分类`);

    const sortedCats = data.categories.slice();
    sortedCats.forEach((cat) => {
      const items = data.aphorisms
        .filter((a) => a.categoryId === cat.id)
        .sort((a, b) => a.createdAt - b.createdAt);
      body += p('Heading1', cat.name);
      if (!items.length) {
        body += p('Muted', '（暂无箴言）');
      } else {
        items.forEach((a) => {
          body += p('Quote', a.text);
          body += p('Muted', fmtDate(a.createdAt));
        });
      }
    });

    const uncat = data.aphorisms
      .filter((a) => !data.categories.some((c) => c.id === a.categoryId))
      .sort((a, b) => a.createdAt - b.createdAt);
    if (uncat.length) {
      body += p('Heading1', '未分类');
      uncat.forEach((a) => {
        body += p('Quote', a.text);
        body += p('Muted', fmtDate(a.createdAt));
      });
    }

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

    const files = [
      { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
      { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
      { name: 'word/document.xml', data: enc.encode(documentXml) },
      { name: 'word/_rels/document.xml.rels', data: enc.encode(DOC_RELS) },
      { name: 'word/styles.xml', data: enc.encode(STYLES) },
    ];
    return makeZip(files);
  }

  function fileName() {
    const d = new Date();
    const s = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `一句箴言-箴言集-${s}.docx`;
  }

  // ---------- 触发导出（分享 / 下载） ----------
  function exportDocx(data) {
    const bytes = buildDocxBytes(data);
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const name = fileName();
    const blob = new Blob([bytes], { type: mime });
    const file = new File([blob], name, { type: mime });

    // 移动端：优先系统分享面板（可直接转发到微信三方应用）
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: '一句箴言', text: '我的箴言集' })
        .catch(() => { /* 用户取消，忽略 */ });
      return;
    }
    // 桌面 / 不支持分享：下载到本地
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // 导出供测试 / 浏览器使用
  if (typeof module !== 'undefined' && module.exports) module.exports = { buildDocxBytes, makeZip };
  if (typeof window !== 'undefined') window.ExportDocx = { exportDocx, buildDocxBytes };
})();
