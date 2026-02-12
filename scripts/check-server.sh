#!/bin/bash
# 在 root@tencent-cloud 上运行此脚本，查看当前正在提供服务的 API 进程与端口
# 用法: bash check-server.sh  或  chmod +x check-server.sh && ./check-server.sh

echo "=== 监听中的端口 (LISTEN) ==="
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || (netstat -an 2>/dev/null | grep LISTEN)

echo ""
echo "=== Node 进程 ==="
ps aux | grep -E "node|npm" | grep -v grep

echo ""
echo "=== 常见 API 端口检测 (7890, 3000, 8080, 80, 443) ==="
for port in 7890 3000 8080 80 443; do
  if command -v curl &>/dev/null; then
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$port/api/health" 2>/dev/null)
    if [ "$code" = "200" ]; then
      echo "端口 $port: /api/health 返回 200"
    else
      echo "端口 $port: 无响应或非 200 (code=$code)"
    fi
  fi
done
