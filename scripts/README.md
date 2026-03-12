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

## deploy-by-scp.ps1（SCP 部署，推荐）

通过 SCP 把本地代码上传到服务器，然后在服务器上执行 `npm install --production` 并重启 `complaints-api`。**不会上传 `data/`**，不会覆盖服务器上的吐槽数据。

**用法（在项目根目录执行）：**
```powershell
.\scripts\deploy-by-scp.ps1
```

需已配置 SSH 主机别名 `tencent-cloud`（见 setup-ssh-key.ps1）。若用 IP，请修改脚本中的 `$HostAlias` 或使用 `$RemoteUser@你的IP`。

## check-server.sh

在服务器上运行，用于检查当前 API 进程与端口。在 `root@tencent-cloud` 上执行：
```bash
bash scripts/check-server.sh
```

## redeploy.sh（仅当服务器用 git 时）

若服务器上是用 `git clone` 拉代码的，可在服务器上拉取后执行此脚本重启服务。**若你平时用 SCP 部署，请用上面的 deploy-by-scp.ps1。**

在服务器上：`cd /opt/accessible-complaint-platform && bash scripts/redeploy.sh`
