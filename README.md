# 基金从业 · 学习站

以 **Markdown 为唯一内容源**，前端用少量原生 JS 渲染成 HTML 的静态站点。

- **科目一** 基金基础知识与法律法规（依据 2026 年度修订考试大纲，教材 2025 年版）
- 内容目录：`content/`
- 部署：GitHub Pages（推送 `main` 自动部署）

## 目录结构

```
├── index.html            # 单页外壳：侧边栏 + 正文 + 阅读工具栏
├── assets/style.css      # 样式
├── content/              # ★ 所有学习笔记的 Markdown 源文件
│   ├── index.json        # 目录清单（新增科目时在这里登记）
│   └── 科目一-基金基础知识与法律法规/
│       ├── 00-总览与进度.md
│       ├── 01-金融市场与资产管理.md
│       └── ...
├── js/
│   ├── app.js            # 渲染器：加载 md → marked 解析 → 目录树 / 页内导航 / 进度
│   └── vendor/marked.min.js  # 本地内置的 markdown 解析器（不依赖 CDN）
└── .github/workflows/pages.yml  # 构建与发布
```

## 写笔记的约定

每篇 `.md` 都用 YAML front matter 声明标题，其余内容按大纲顺序组织：

```markdown
---
title: 第一章 金融市场与资产管理
order: 1
---
```

新增一篇笔记：在 `content/<科目>/` 下新建 md，再把它登记到该科目内的 `目录.json`（文件名 + 标题）。

> 本地预览：需要 HTTP 服务（`fetch` 不能读 `file://`）。
> ```bash
> python3 -m http.server 8000
> # 然后打开 http://127.0.0.1:8000
> ```

## 未收录的内容

教材 PDF 体积过大（合计约 2 GB），不纳入仓库。笔记中的页码均指教材**印刷页码**，
PDF 页码 = 印刷页码 + 8。
