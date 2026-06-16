# Knowledge Graph Backend

这是知识图谱的独立后端服务。它负责：

- 提供图谱数据：`GET /api/graph`
- 新增知识节点：`POST /api/nodes`
- 新增资源链接：`POST /api/resources`
- 上传本地文件并自动生成资源节点：`POST /api/resources/upload`

## 启动

```powershell
cd backend
npm install
npm run dev
```

默认端口是 `8787`，可用环境变量覆盖：

```powershell
$env:PORT=8787
```

## 前端连接

在前端页面加载前设置：

```html
<script>
  window.KNOWLEDGE_API_BASE = "http://localhost:8787";
</script>
```

如果后端不可用，前端会自动回退到静态 JSON。

## 自动识别文件类型

上传文件时，后端会根据扩展名生成资源类型：

- `.md`, `.markdown`: Markdown
- `.pdf`: PDF
- `.html`, `.htm`, `http(s)://...`: Web
- 其他扩展名：File
