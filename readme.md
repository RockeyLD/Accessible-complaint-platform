# 无障碍吐槽平台（前端 + 简易后端）

适用文件：`index.html`（提交）与 `查看吐槽.html`（查看）

## 1. 简介
“无障碍吐槽平台”提供两个前端页面和一个本机后端，用于提交与查看吐槽记录。数据保存在本机后端文件 `data/complaints.json`，不会自动上传到公网。

## 2. 在线预览（可选）
在线页面地址（若已开启 GitHub Pages）：  
https://rockeyld.github.io/Accessible-complaint-platform/

说明：在线页面仅展示前端界面，如需真实存储，请部署后端并在浏览器控制台设置：
`localStorage.setItem("apiBase", "https://你的Worker域名.workers.dev")`

## 3. 本地启动后端
1) 安装 Node.js（建议 18+）。  
2) 在项目目录运行：  
   - `npm install`  
   - `npm start`  
3) 浏览器打开：  
   - `http://localhost:8000/index.html`  
   - `http://localhost:8000/查看吐槽.html`

也可以直接双击打开 HTML，但需确保后端在运行。

## 4. API 基础地址
默认使用当前站点地址；如果页面通过 `file://` 打开，默认请求 `http://localhost:8000`。  
如需自定义后端地址，可在控制台执行：  
`localStorage.setItem("apiBase", "http://你的地址:8000")`

## 5. 功能
- 提交吐槽：听障与视障两种模式均可提交到后端。
- 查看吐槽：支持搜索、生成报告、复制、删除、清空。
- 主题与辅助功能：字号、主题、高对比、点击朗读等。

## 6. Cloudflare Workers + D1（免费持久化）
### 6.1 初始化
1) 安装 Wrangler：
`npm i -D wrangler@latest`
2) 登录：
`npx wrangler login`
3) 创建数据库：
`npx wrangler d1 create complaints-db`
4) 把输出的 `database_id` 写入 `wrangler.jsonc` 的 `database_id`。

### 6.2 建表
`npx wrangler d1 execute complaints-db --remote --file ./schema.sql`

### 6.3 部署
`npx wrangler deploy`

### 6.4 前端指向后端
浏览器控制台执行：
`localStorage.setItem("apiBase", "https://你的Worker域名.workers.dev")`
