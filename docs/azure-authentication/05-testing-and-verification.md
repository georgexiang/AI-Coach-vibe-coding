# 05 — 测试与验证

> 认证模块的测试策略、测试用例说明和故障排查方法。

---

## 1. 测试文件位置

```
backend/tests/test_azure_auth.py    — 单元测试（15个测试用例）
```

---

## 2. 测试覆盖的场景

### 2.1 `TestGetAzureCredential` — 凭据获取

| 测试 | 验证内容 |
|------|---------|
| `test_returns_credential_when_available` | azure-identity 可用时返回 credential 实例 |
| `test_returns_none_when_import_fails` | azure-identity 未安装时返回 None（不 crash） |

### 2.2 `TestGetBearerToken` — Token 获取

| 测试 | 验证内容 |
|------|---------|
| `test_returns_token_on_success` | AAD 正常时返回 token 字符串 |
| `test_returns_none_when_no_credential` | 无 credential 时返回 None |
| `test_returns_none_on_token_error` | get_token 异常时返回 None（不 crash） |
| `test_custom_scope` | 自定义 scope 正确传递 |

### 2.3 `TestGetAzureOpenAIClient` — 客户端创建

| 测试 | 验证内容 |
|------|---------|
| `test_uses_aad_token_when_available` | AAD 可用时用 `azure_ad_token` 创建客户端 |
| `test_falls_back_to_api_key` | AAD 失败时用 `api_key` 创建客户端 |
| `test_raises_when_no_credentials` | 两者都不可用时抛 RuntimeError |
| `test_passes_api_version` | api_version 正确传递 |
| `test_passes_timeout` | timeout 参数正确传递 |
| `test_no_timeout_by_default` | 不指定 timeout 时不传该参数 |

### 2.4 `TestGetAuthHeaders` — HTTP 头

| 测试 | 验证内容 |
|------|---------|
| `test_uses_aad_token_when_available` | AAD 可用时返回 Bearer Authorization |
| `test_falls_back_to_api_key` | AAD 不可用时返回 Ocp-Apim-Subscription-Key |
| `test_raises_when_no_credentials` | 两者都不可用时抛 RuntimeError |

---

## 3. 运行测试

```bash
cd backend
source .venv/bin/activate

# 只运行认证模块测试
pytest tests/test_azure_auth.py -v

# 运行所有相关测试
pytest tests/test_azure_auth.py tests/test_scoring_engine.py tests/test_connection_tester.py -v

# 运行全部测试（确保无回归）
pytest -v
```

---

## 4. 测试设计原则

### 4.1 Mock 策略

所有测试使用 `unittest.mock` 来隔离 Azure SDK 依赖：

```python
# Mock DefaultAzureCredential
with patch("azure.identity.aio.DefaultAzureCredential", return_value=mock_cred):
    ...

# Mock get_bearer_token (测试 get_auth_headers 时)
with patch("app.services.azure_auth.get_bearer_token", new=AsyncMock(return_value=None)):
    ...
```

**为什么 Mock？**
- 测试不应依赖真实的 Azure 连接
- 可以模拟各种失败场景（网络错误、Token 过期、SDK 缺失）
- 快速执行（无网络 IO）

### 4.2 关键验证点

每个测试都验证：
1. **正确的认证方式被使用**（`azure_ad_token` vs `api_key`）
2. **参数正确传递**（endpoint, version, timeout）
3. **降级行为**（AAD 失败 → Key fallback）
4. **错误处理**（无凭据 → RuntimeError, 无 SDK → 不 crash）

---

## 5. 集成测试（手动验证）

### 5.1 验证 AAD Token 认证

```bash
# 1. 确保已登录
az login
az account show  # 确认订阅正确

# 2. 启动后端
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 3. 调用评分接口
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"user123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -X POST "http://localhost:8000/api/v1/scoring/sessions/<session-id>/rescore" \
  -H "Authorization: Bearer $TOKEN"
```

### 5.2 验证 Key Fallback

```bash
# 1. 模拟 AAD 不可用（退出登录）
az logout

# 2. 确保管理面板有 API Key 配置

# 3. 调用相同接口 — 应该用 Key 成功（如果资源允许 Key）
curl -X POST "http://localhost:8000/api/v1/scoring/sessions/<session-id>/rescore" \
  -H "Authorization: Bearer $TOKEN"
```

### 5.3 验证连接测试器

```bash
# 管理面板的连接测试会调用 connection_tester.py
# 在 UI 上点击「Test Connection」按钮
# 应该显示绿色成功（使用 AAD token）
```

---

## 6. 故障排查

### 6.1 开启 Debug 日志

```python
# 在 .env 中添加:
LOG_LEVEL=DEBUG

# 或在代码中临时开启:
import logging
logging.getLogger("app.services.azure_auth").setLevel(logging.DEBUG)
```

Debug 日志输出示例：
```
azure_auth: creating AsyncAzureOpenAI with AAD token for https://...
# 或
azure_auth: DefaultAzureCredential unavailable (...), falling back to API Key
azure_auth: creating AsyncAzureOpenAI with API Key for https://...
```

### 6.2 常见问题排查

```bash
# 检查 az login 状态
az account show

# 检查 token 是否有效
az account get-access-token --resource https://cognitiveservices.azure.com

# 检查 RBAC 角色
az role assignment list \
  --assignee $(az account show --query user.name -o tsv) \
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<resource>

# 需要的角色: "Cognitive Services OpenAI User" 或 "Cognitive Services Contributor"
```

### 6.3 验证脚本

```python
"""快速验证认证模块可用性的脚本。"""
import asyncio

async def verify_auth():
    from app.services.azure_auth import get_bearer_token, get_azure_openai_client

    # Test 1: Bearer Token
    token = await get_bearer_token()
    if token:
        print(f"✓ AAD Token 获取成功 (长度: {len(token)})")
    else:
        print("✗ AAD Token 不可用，将使用 Key fallback")

    # Test 2: OpenAI Client
    try:
        client = await get_azure_openai_client(
            endpoint="https://your-endpoint.openai.azure.com",
            api_key="optional-fallback-key",
        )
        print(f"✓ OpenAI Client 创建成功: {type(client).__name__}")
    except RuntimeError as e:
        print(f"✗ 无法创建 Client: {e}")

if __name__ == "__main__":
    asyncio.run(verify_auth())
```

---

## 7. CI/CD 中的认证

### GitHub Actions

```yaml
# .github/workflows/ci.yml 中:
env:
  AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
  AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
  AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}

# DefaultAzureCredential 会自动使用这些环境变量
# 无需 `az login`
```

### Azure Container Apps

```bash
# 启用 System Assigned Managed Identity
az containerapp identity assign --name <app-name> --resource-group <rg>

# 分配 RBAC 角色
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Cognitive Services OpenAI User" \
  --scope <openai-resource-id>

# DefaultAzureCredential 自动使用 Managed Identity，零配置
```
