/* ==========================================================================
   基金从业 · 学习站
   纯前端渲染：加载 Markdown → marked 解析 → 注入增强（目录、进度、翻页）
   ========================================================================== */

(function () {
  "use strict";

  const CONTENT_ROOT = "content/";
  const STORAGE_KEY = "fund-exam:done";
  const THEME_KEY = "fund-exam:theme";
  const SUBJECT_KEY = "fund-exam:subject";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    subjects: [],
    subject: null,
    catalog: [],
    currentIndex: 0,
    done: loadJSON(STORAGE_KEY, {}),   // { "科目一/01-金融市场与资产管理.md#k-1.1.a": true }
  };

  /* ---------------- 工具 ---------------- */

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 隐私模式忽略 */ }
  }

  async function fetchText(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}：${path}`);
    return res.text();
  }

  async function fetchJSON(path) {
    return JSON.parse(await fetchText(path));
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  /* ---------------- 主题 ---------------- */

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = saved || (prefersDark ? "dark" : "light");
    $("#theme-btn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* noop */ }
    });
  }

  /* ---------------- 进度：知识点完成状态 ---------------- */

  function keyOf(pageId, anchor) {
    return `${state.subject.dir}/${pageId}${anchor ? "#" + anchor : ""}`;
  }

  function isDone(pageId, anchor) {
    return Boolean(state.done[keyOf(pageId, anchor)]);
  }

  function setDone(pageId, anchor, value) {
    const k = keyOf(pageId, anchor);
    if (value) state.done[k] = true;
    else delete state.done[k];
    saveJSON(STORAGE_KEY, state.done);
  }

  /* ---------------- 路由 ---------------- */

  function parseHash() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (!raw) return { page: 0, anchor: "" };
    const [p, anchor] = raw.split("#");
    const idx = state.catalog.findIndex((c) => c.file === p);
    return { page: idx >= 0 ? idx : 0, anchor: anchor || "" };
  }

  function setHash(pageIndex, anchor) {
    const page = state.catalog[pageIndex];
    if (!page) return;
    const h = `#/${encodeURIComponent(page.file)}${anchor ? "#" + anchor : ""}`;
    if (location.hash !== h) history.pushState(null, "", h);
  }

  /* ---------------- 科目切换 ---------------- */

  function applySubjectBrand() {
    const small = $(".brand-text small");
    if (small) small.textContent = state.subject.brand || state.subject.name;
    document.title = `基金从业 · ${state.subject.short || state.subject.name}`;
  }

  function renderSubjectSwitch() {
    if (state.subjects.length < 2) return null;
    const wrap = document.createElement("div");
    wrap.className = "subj-switch";
    state.subjects.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.short || s.name;
      b.title = s.name;
      b.setAttribute("aria-pressed", String(state.subject === s));
      b.addEventListener("click", () => { selectSubject(i); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  async function selectSubject(i) {
    const subj = state.subjects[i];
    if (!subj || subj === state.subject) return;
    try {
      const cat = await fetchJSON(CONTENT_ROOT + subj.catalog);
      state.subject = subj;
      state.catalog = cat.chapters || [];
      saveJSON(SUBJECT_KEY, i);
      applySubjectBrand();
      const first = state.catalog[0];
      history.replaceState(null, "", "#/" + (first ? encodeURIComponent(first.file) : ""));
      await loadPage(0, "", { replaceScroll: true });
    } catch (err) {
      console.error(err);
      $("#article").innerHTML = `<p class="error">切换科目失败：${err.message}</p>`;
    }
  }

  /* ---------------- 侧栏目录 ---------------- */

  function renderSidebar() {
    const toc = $("#toc");
    toc.innerHTML = "";

    const switcher = renderSubjectSwitch();
    if (switcher) toc.appendChild(switcher);

    const group = document.createElement("div");
    group.className = "toc-group";

    const title = document.createElement("p");
    title.className = "toc-group-title";
    title.textContent = state.subject.short;
    group.appendChild(title);

    state.catalog.forEach((page, i) => {
      const a = document.createElement("a");
      a.className = "toc-page";
      a.href = `#/${encodeURIComponent(page.file)}`;
      a.dataset.index = String(i);

      const no = document.createElement("span");
      no.className = "pg-no";
      no.textContent = page.no || String(i).padStart(2, "0");

      const label = document.createElement("span");
      label.textContent = page.title;

      const prog = document.createElement("span");
      prog.className = "pg-progress";
      prog.dataset.page = page.file;

      a.append(no, label, prog);
      group.appendChild(a);

      // 当前页的知识点导航
      if (i === state.currentIndex && page.headings && page.headings.length) {
        const ul = document.createElement("ul");
        ul.className = "toc-sub";
        page.headings.forEach((h) => {
          const li = document.createElement("li");
          const sub = document.createElement("a");
          sub.href = `#/${encodeURIComponent(page.file)}#${h.id}`;
          sub.dataset.anchor = h.id;
          sub.textContent = h.text;
          sub.title = h.text;
          li.appendChild(sub);
          ul.appendChild(li);
        });
        group.appendChild(ul);
      }
    });

    toc.appendChild(group);
    paintSidebar();
  }

  function pageStats(page) {
    const heads = page.headings || [];
    if (!heads.length) return null;
    const doneCount = heads.filter((h) => isDone(page.file, h.id)).length;
    return { done: doneCount, total: heads.length };
  }

  function paintSidebar() {
    $$(".toc-page").forEach((el) => {
      const i = Number(el.dataset.index);
      el.classList.toggle("active", i === state.currentIndex);
      const page = state.catalog[i];
      const stats = pageStats(page);
      const prog = $(".pg-progress", el);
      if (!stats) { prog.textContent = ""; prog.classList.remove("done"); return; }
      prog.textContent = `${stats.done}/${stats.total}`;
      prog.classList.toggle("done", stats.done === stats.total);
    });
    paintGlobalProgress();
  }

  function paintGlobalProgress() {
    let done = 0, total = 0;
    state.catalog.forEach((p) => {
      const s = pageStats(p);
      if (s) { done += s.done; total += s.total; }
    });
    const chip = $("#progress-chip");
    chip.textContent = total ? `已完成 ${done} / ${total} 知识点` : "—";
  }

  function paintSubNav(activeId) {
    $$(".toc-sub a").forEach((a) => {
      const id = a.dataset.anchor;
      a.classList.toggle("active", id === activeId);
      const page = state.catalog[state.currentIndex];
      const done = isDone(page.file, id);
      a.classList.toggle("is-done", done);
      const head = page.headings.find((h) => h.id === id);
      const text = (head ? head.text : a.textContent).replace(/^\s*(✅|☑️)\s*/, "");
      a.textContent = (done ? "✓ " : "") + text;
    });
  }

  /* ---------------- 正文渲染 ---------------- */

  const LEVELS = [
    { re: /【掌握】/, cls: "lvl-master", label: "掌握" },
    { re: /【理解】/, cls: "lvl-understand", label: "理解" },
    { re: /【了解】/, cls: "lvl-know", label: "了解" },
  ];

  // 匹配标题开头的知识点编号；结尾的 "+" 表示教材补充（不算大纲知识点）
  const KIND_RE = /^\s*(\d+\.\d+(?:-\d+)?\.[a-z])(\+)?/;

  marked.setOptions({ gfm: true, breaks: false });

  function stripFrontMatter(src) {
    const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { meta: {}, body: src };
    const meta = {};
    m[1].split(/\r?\n/).forEach((line) => {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return { meta, body: src.slice(m[0].length) };
  }

  function slugify(text, i) {
    const ascii = text.replace(/[^\w.\-]+/g, "");
    return ascii ? "h-" + ascii : "h-" + i;
  }

  /**
   * 摘掉标题开头的一段文字（可能跨多个文本节点）。
   * matcher 可以是正则，也可以是字面量字符串（会转义并锚定到开头）。
   * 例："1.1.a 【掌握】金融市场的概念 📖 P2" 依次摘掉编号与【掌握】。
   */
  function stripLeadingText(el, matcher) {
    const re = typeof matcher === "string"
      ? new RegExp("^\\s*" + matcher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      : new RegExp("^\\s*" + matcher.source);

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent;
      if (!t.trim()) continue;
      if (!re.test(t)) return;                    // 匹配段还没出现，继续找
      node.textContent = t.replace(re, "").trim();
      return;
    }
  }

  function enhanceHeadings(root, pageId) {
    const headings = [];
    $$("h2, h3, h4", root).forEach((h, i) => {
      // 锚点先于重排标题生成，用纯文本 + 序号，避免把徽章文字或页码掺进 id
      h.id = h.id || slugify(h.textContent.replace(/\s+/g, " ").trim(), i);
      if (h.tagName !== "H3") return;

      const badges = [];

      // 知识点编号（如 1.1.a；带 "+" 的是教材补充，不算大纲知识点）
      const kind = h.textContent.match(KIND_RE);
      if (kind) {
        const isExtra = Boolean(kind[2]);
        if (isExtra) {
          h.classList.add("is-extra");
        } else {
          const code = document.createElement("span");
          code.className = "kcode";
          code.textContent = kind[1];
          badges.push(code);
        }
        stripLeadingText(h, kind[0]);
      }

      // 能力等级标签
      for (const lvl of LEVELS) {
        if (lvl.re.test(h.textContent)) {
          const span = document.createElement("span");
          span.className = "lvl " + lvl.cls;
          span.textContent = lvl.label;
          badges.push(span);
          stripLeadingText(h, lvl.re);
          break;
        }
      }

      badges.reverse().forEach((b) => h.insertBefore(b, h.firstChild));

      h.classList.add("is-pending");

      const label = h.textContent.replace(/\s+/g, " ").trim();
      // 教材补充不是大纲知识点，不进目录、不进进度统计
      if (h.classList.contains("is-extra")) return;
      headings.push({ id: h.id, text: label, anchor: h.id });
    });

    // 注入完成按钮
    $$("h3", root).forEach((h) => {
      if (h.classList.contains("is-extra")) return;
      const btn = document.createElement("button");
      btn.className = "check-btn";
      btn.type = "button";
      btn.dataset.anchor = h.id;
      h.after(btn);
      paintCheckBtn(btn, pageId, h.id);
      btn.addEventListener("click", () => {
        const next = !isDone(pageId, h.id);
        setDone(pageId, h.id, next);
        paintCheckBtn(btn, pageId, h.id);
        applyDoneClasses(root, pageId);
        paintSidebar();
        paintSubNav(lastActiveAnchor);
      });
    });

    return headings;
  }

  function paintCheckBtn(btn, pageId, anchor) {
    const done = isDone(pageId, anchor);
    btn.classList.toggle("done", done);
    btn.textContent = done ? "✓ 已完成 · 点击撤销" : "标记为已完成";
  }

  function applyDoneClasses(root, pageId) {
    $$("h3", root).forEach((h) => {
      if (h.classList.contains("is-extra")) return;
      const done = isDone(pageId, h.id);
      h.classList.toggle("is-done", done);
      h.classList.toggle("is-pending", !done);
    });
  }

  function enhanceTables(root) {
    $$("table", root).forEach((t) => {
      if (t.parentElement.classList.contains("table-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  function enhanceTaskLists(root) {
    $$("input[type='checkbox']", root).forEach((cb) => {
      cb.disabled = false;
      const li = cb.closest("li");
      if (li) li.classList.toggle("checked", cb.checked);
      cb.addEventListener("change", () => {
        if (li) li.classList.toggle("checked", cb.checked);
      });
    });
    $$("ul", root).forEach((ul) => {
      if ($("input[type='checkbox']", ul) && !ul.classList.contains("task-list")) {
        ul.classList.add("task-list");
      }
    });
  }

  function enhanceAnswers(root) {
    $$("details", root).forEach((d) => {
      const summary = $("summary", d);
      if (!summary) return;

      const body = d.cloneNode(true);
      const s = $("summary", body);
      if (s) s.remove();

      const btn = document.createElement("button");
      btn.className = "check-btn";
      btn.type = "button";
      btn.textContent = "👀 " + summary.textContent.trim();
      btn.addEventListener("click", () => {
        $("#answer-body").innerHTML = body.innerHTML;
        $("#answer-pop").hidden = false;
      });

      d.replaceWith(btn);   // 原地替换，保留阅读位置
    });
  }

  function renderPage(page, src) {
    const article = $("#article");
    const { meta, body } = stripFrontMatter(src);

    article.innerHTML = marked.parse(body);

    // 去掉正文里的第一个 h1（由页面标题统一展示，避免重复）
    const h1 = $("h1", article);
    if (h1) h1.remove();

    enhanceTables(article);
    enhanceTaskLists(article);
    enhanceAnswers(article);

    const headings = enhanceHeadings(article, page.file);
    page.headings = headings;

    article.classList.remove("loading");
    document.title = (meta.title || page.title) + " · 基金从业 学习站";
  }

  function renderPager() {
    const pager = $("#pager");
    pager.innerHTML = "";
    const mk = (idx, kind) => {
      const p = state.catalog[idx];
      const a = document.createElement("a");
      a.className = "pager-link " + kind;
      a.href = `#/${encodeURIComponent(p.file)}`;
      a.innerHTML = `<span class="lbl">${kind === "prev" ? "← 上一篇" : "下一篇 →"}</span><span class="ttl"></span>`;
      $(".ttl", a).textContent = p.title;
      return a;
    };
    if (state.currentIndex > 0) pager.appendChild(mk(state.currentIndex - 1, "prev"));
    else pager.appendChild(Object.assign(document.createElement("span"), { className: "spacer" }));
    if (state.currentIndex < state.catalog.length - 1) pager.appendChild(mk(state.currentIndex + 1, "next"));
  }

  /* ---------------- 页内滚动高亮 ---------------- */

  let lastActiveAnchor = "";
  const onScroll = debounce(() => {
    const heads = $$("h3, h2", $("#article"));
    let active = lastActiveAnchor;
    for (const h of heads) {
      if (h.getBoundingClientRect().top < 120) active = h.id;
      else break;
    }
    if (active !== lastActiveAnchor) {
      lastActiveAnchor = active;
      paintSubNav(active);
    }
  }, 80);

  /* ---------------- 主流程 ---------------- */

  async function loadPage(index, anchor, { replaceScroll = false } = {}) {
    state.currentIndex = index;
    const page = state.catalog[index];
    lastActiveAnchor = "";
    renderSidebar();
    renderPager();

    $("#article").innerHTML = `<p class="loading">正在加载「${page.title}」…</p>`;

    try {
      const src = await fetchText(CONTENT_ROOT + state.subject.dir + "/" + page.file);
      renderPage(page, src);
      applyDoneClasses($("#article"), page.file);
      renderSidebar();   // 用真实标题重绘知识点头
      renderPager();

      if (anchor) {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ block: "start" });
          lastActiveAnchor = anchor;
          paintSubNav(anchor);
        }
      } else if (!replaceScroll) {
        window.scrollTo({ top: 0 });
      }
      document.body.classList.remove("nav-open");
    } catch (err) {
      $("#article").innerHTML = `<p class="error">加载失败：${err.message}</p>`;
      console.error(err);
    }
  }

  async function boot() {
    initTheme();

    const root = await fetchJSON(CONTENT_ROOT + "index.json");
    state.subjects = root.subjects || [];
    if (!state.subjects.length) throw new Error("content/index.json 中没有任何科目");

    const saved = loadJSON(SUBJECT_KEY, 0);
    const idx = Number.isInteger(saved) && state.subjects[saved] ? saved : 0;
    const subj = state.subjects[idx];
    const cat = await fetchJSON(CONTENT_ROOT + subj.catalog);
    state.subject = subj;
    state.catalog = cat.chapters || [];
    applySubjectBrand();

    // 菜单按钮
    $("#menu-btn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
    $("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
    $("#answer-close").addEventListener("click", () => ($("#answer-pop").hidden = true));
    $("#answer-pop").addEventListener("click", (e) => {
      if (e.target.id === "answer-pop") $("#answer-pop").hidden = true;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("#answer-pop").hidden = true;
    });

    window.addEventListener("hashchange", () => {
      const { page, anchor } = parseHash();
      loadPage(page, anchor, { replaceScroll: true });
    });
    window.addEventListener("scroll", onScroll, { passive: true });

    const { page, anchor } = parseHash();
    await loadPage(page, anchor);
  }

  boot().catch((err) => {
    console.error(err);
    $("#article").innerHTML = `<p class="error">站点初始化失败：${err.message}</p>`;
  });
})();
