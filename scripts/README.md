# 脚本说明

## setup-ssh-key.ps1（Windows）

在本地配置 SSH 公钥并上传到腾讯云 `root@tencent-cloud`，便于免密登录与部署。

**使用前：**

1. 在 `~/.ssh/config` 中配置主机别名，例如：
   ```
   Host tencent-cloud
       HostName 你的腾讯云公网IP或域名
       User root
   ```

2. 在 PowerShell 中执行（需允许脚本执行时可先运行 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`）：
   ```powershell
   cd scripts
   .\setup-ssh-key.ps1
   ```

3. 首次运行若尚未配置密钥，会提示输入服务器密码；完成后可用 `ssh root@tencent-cloud` 免密登录。

**服务器目录：** 部署文档中约定的代码目录为 `/opt/accessible-complaint-platform`。

## check-server.sh

在服务器上运行，用于检查当前 API 进程与端口。在 `root@tencent-cloud` 上执行：
```bash
bash scripts/check-server.sh
```
