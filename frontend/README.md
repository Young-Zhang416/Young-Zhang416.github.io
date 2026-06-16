# Frontend

前端目前以仓库根目录的静态页面发布到 GitHub Pages。

核心页面：

- `../knowledge.html`: 可交互知识图谱页面
- `../assets/js/knowledge-graph.js`: 图谱渲染、拖拽、搜索、资源跳转
- `../assets/data/knowledge-graph.json`: 无后端时的静态图谱数据
- `../assets/css/site.css`: 全站样式

## API 配置

默认情况下，前端会读取：

```text
assets/data/knowledge-graph.json
```

如果你部署了后端，可以在页面加载前设置：

```html
<script>
  window.KNOWLEDGE_API_BASE = "https://your-api.example.com";
</script>
```

设置后，前端会优先请求：

```text
GET /api/graph
```

请求失败时会自动回退到静态 JSON，保证 GitHub Pages 仍然可用。
