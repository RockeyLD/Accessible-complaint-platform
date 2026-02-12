# 配置 SSH 公钥并上传到 root@tencent-cloud
# 使用前请确保已在 ~/.ssh/config 中配置 tencent-cloud 主机（或本脚本会使用 root@tencent-cloud）
# 服务器上代码目录：/opt/accessible-complaint-platform

$ErrorActionPreference = "Stop"
$HostAlias = "tencent-cloud"
$RemoteUser = "root"
$KeyName = "id_ed25519"
$KeyPath = Join-Path $env:USERPROFILE ".ssh" $KeyName
$KeyPathPub = "$KeyPath.pub"

# 若不存在则生成密钥
if (-not (Test-Path $KeyPathPub)) {
    Write-Host "未检测到公钥，正在生成 SSH 密钥（Ed25519）..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path (Split-Path $KeyPath) -Force | Out-Null
    ssh-keygen -t ed25519 -f $KeyPath -N '""' -C "accessible-complaint-platform@$(hostname)"
    if (-not (Test-Path $KeyPathPub)) { throw "密钥生成失败" }
    Write-Host "密钥已生成: $KeyPathPub" -ForegroundColor Green
} else {
    Write-Host "使用已有公钥: $KeyPathPub" -ForegroundColor Cyan
}

# 上传公钥到服务器（通过管道追加到 authorized_keys）
Write-Host "正在将公钥上传到 ${RemoteUser}@${HostAlias} ..." -ForegroundColor Yellow
Get-Content $KeyPathPub -Raw | ssh "${RemoteUser}@${HostAlias}" "mkdir -p .ssh && chmod 700 .ssh && cat >> .ssh/authorized_keys && chmod 600 .ssh/authorized_keys"

if ($LASTEXITCODE -ne 0) {
    Write-Host "上传失败。若尚未配置过 SSH，请先用密码登录一次：ssh ${RemoteUser}@${HostAlias}" -ForegroundColor Red
    Write-Host "`n也可手动执行：" -ForegroundColor Yellow
    Write-Host "  Get-Content `"$KeyPathPub`" | ssh ${RemoteUser}@${HostAlias} `"mkdir -p .ssh; cat >> .ssh/authorized_keys`"" -ForegroundColor Gray
    exit 1
}

Write-Host "公钥已写入服务器 ~/.ssh/authorized_keys。" -ForegroundColor Green
Write-Host "建议测试免密登录: ssh ${RemoteUser}@${HostAlias}" -ForegroundColor Cyan
