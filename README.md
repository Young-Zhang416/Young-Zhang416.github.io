# Young Zhang Personal Website

这是一个用于 GitHub Pages 的纯静态个人网站骨架。

## 页面

- `index.html`: 首页
- `posts.html`: 文章列表
- `knowledge.html`: 可交互知识图谱
- `about.html`: 关于页
- `posts/hello-world.html`: 示例文章
- `assets/css/site.css`: 全站样式

## 前后端分离

- 前端：仓库根目录的静态页面，可继续部署到 GitHub Pages。
- 后端：`backend/`，提供知识图谱 API 和资源上传接口。

前端默认读取 `assets/data/knowledge-graph.json`。部署后端后，可通过 `window.KNOWLEDGE_API_BASE` 指向 API 服务。

## 本地预览

直接在浏览器中打开 `index.html` 即可。

## 自动生成站点数据

运行：

```powershell
npm run generate:data
```

脚本会自动计算文章字数、预计阅读时间，并根据 Git 历史生成提交热力图数据。

## 发布

提交并推送到 `main` 分支后，在 GitHub 仓库的 Pages 设置中选择从 `main` 分支发布。
