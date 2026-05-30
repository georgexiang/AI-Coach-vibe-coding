#!/bin/bash
###############################################################################
# 刷新 Azure Bearer Token 到 .env
#
# 使用 az login 的凭据自动获取 AI Foundry token (audience: https://ai.azure.com) 并写入 .env
# 运行一次即可，token 有效期约 1 小时，过期后重新运行
#
# 用法：
#   az login              # 首次或过期时
#   ./refresh-token.sh    # 刷新 token
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# 检查 az cli
if ! command -v az &> /dev/null; then
  echo "错误：未安装 Azure CLI (az)，请先安装"
  exit 1
fi

# 检查是否已登录
if ! az account show &> /dev/null 2>&1; then
  echo "错误：未登录 Azure，请先运行 az login"
  exit 1
fi

# 获取 token
echo "正在获取 Bearer Token..."
TOKEN=$(az account get-access-token \
  --resource https://ai.azure.com \
  --query accessToken -o tsv)

if [ -z "$TOKEN" ]; then
  echo "错误：获取 token 失败"
  exit 1
fi

# 写入 .env
if [ ! -f "$ENV_FILE" ]; then
  echo "AZURE_FOUNDRY_BEARER_TOKEN=$TOKEN" > "$ENV_FILE"
  echo "已创建 $ENV_FILE 并写入 token"
elif grep -q "AZURE_FOUNDRY_BEARER_TOKEN" "$ENV_FILE"; then
  # macOS sed 兼容写法
  sed -i '' "s|AZURE_FOUNDRY_BEARER_TOKEN=.*|AZURE_FOUNDRY_BEARER_TOKEN=$TOKEN|" "$ENV_FILE" 2>/dev/null \
    || sed -i "s|AZURE_FOUNDRY_BEARER_TOKEN=.*|AZURE_FOUNDRY_BEARER_TOKEN=$TOKEN|" "$ENV_FILE"
  echo "已更新 .env 中的 token"
else
  echo "AZURE_FOUNDRY_BEARER_TOKEN=$TOKEN" >> "$ENV_FILE"
  echo "已追加 token 到 .env"
fi

# 显示过期时间
EXPIRES=$(az account get-access-token \
  --resource https://ai.azure.com \
  --query expiresOn -o tsv)
echo "Token 有效期至：$EXPIRES"
echo "完成！可以在 VS Code 中运行 agent-metadata-api-rbac.http 测试了"
