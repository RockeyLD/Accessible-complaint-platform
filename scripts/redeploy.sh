#!/bin/bash
# 在服务器上重新部署：拉取最新代码并重启 complaints-api
# 用法（在服务器上）: cd /opt/accessible-complaint-platform && bash scripts/redeploy.sh
# 或从本机 SSH 执行: ssh root@tencent-cloud "cd /opt/accessible-complaint-platform && bash scripts/redeploy.sh"

set -e
cd "$(dirname "$0")/.."

echo "=== 拉取最新代码 ==="
git pull

echo ""
echo "=== 安装依赖 ==="
npm install --production

echo ""
echo "=== 重启 complaints-api ==="
systemctl restart complaints-api

echo ""
echo "=== 服务状态 ==="
systemctl status complaints-api --no-pager

echo ""
echo "=== 健康检查 ==="
sleep 2
curl -s http://127.0.0.1:7890/api/health || true
echo ""
