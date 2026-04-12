"""AI Foundry 部署列表 API 探测测试。

实测三种 API 路径在 AI Foundry 端点上的行为差异，
验证正确的部署列表获取方式。

用法:
    # 直接运行（需要 .env 中配置 AZURE_FOUNDRY_* 变量）
    cd backend && source .venv/bin/activate
    python3 ../docs/microsoft-foundry/tests/test_foundry_deployments.py

    # 或指定环境变量
    AZURE_FOUNDRY_ENDPOINT=https://xxx.services.ai.azure.com \
    AZURE_FOUNDRY_API_KEY=xxx \
    AZURE_FOUNDRY_DEFAULT_PROJECT=xxx \
    python3 test_foundry_deployments.py
"""

import asyncio
import os
import sys

import httpx

# ---------- 配置 ----------

# 尝试从 backend/.env 加载
ENV_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend", ".env")
if os.path.exists(ENV_FILE):
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

ENDPOINT = os.environ.get("AZURE_FOUNDRY_ENDPOINT", "").rstrip("/")
API_KEY = os.environ.get("AZURE_FOUNDRY_API_KEY", "")
PROJECT = os.environ.get("AZURE_FOUNDRY_DEFAULT_PROJECT", "")


async def main():
    if not ENDPOINT or not API_KEY:
        print("ERROR: 请配置 AZURE_FOUNDRY_ENDPOINT 和 AZURE_FOUNDRY_API_KEY")
        sys.exit(1)

    print(f"端点: {ENDPOINT}")
    print(f"项目: {PROJECT or '(未配置)'}")
    print("=" * 70)

    headers = {"api-key": API_KEY}

    async with httpx.AsyncClient(timeout=15.0) as client:

        # ---- 测试 1：/openai/deployments（传统 Azure OpenAI 路径）----
        print("\n[测试 1] GET /openai/deployments?api-version=2024-10-21")
        url = f"{ENDPOINT}/openai/deployments?api-version=2024-10-21"
        resp = await client.get(url, headers=headers)
        print(f"  状态: {resp.status_code}")
        if resp.status_code == 200:
            items = resp.json().get("data", [])
            print(f"  结果: {len(items)} 个部署")
            for d in items:
                print(f"    - {d.get('id')}: model={d.get('model')}")
        else:
            print(f"  错误: {resp.text[:200]}")
            print("  结论: ✗ AI Foundry 端点不支持此路径")

        # ---- 测试 2：/openai/models（区域模型目录）----
        print("\n[测试 2] GET /openai/models?api-version=2024-10-21")
        url = f"{ENDPOINT}/openai/models?api-version=2024-10-21"
        resp = await client.get(url, headers=headers)
        print(f"  状态: {resp.status_code}")
        if resp.status_code == 200:
            items = resp.json().get("data", [])
            print(f"  结果: {len(items)} 个模型（区域目录，非用户部署）")
            # 只显示 gpt 系列
            gpt_models = [d for d in items if d.get("id", "").startswith("gpt-")]
            print(f"  其中 GPT 系列: {len(gpt_models)} 个")
            for d in gpt_models[:5]:
                print(f"    - {d['id']}")
            if len(gpt_models) > 5:
                print(f"    ... 还有 {len(gpt_models) - 5} 个")
        else:
            print(f"  错误: {resp.text[:200]}")

        # ---- 测试 3：/api/projects/{project}/deployments（正确路径）----
        if PROJECT:
            print(f"\n[测试 3] GET /api/projects/{PROJECT}/deployments?api-version=v1")
            url = f"{ENDPOINT}/api/projects/{PROJECT}/deployments?api-version=v1"
            resp = await client.get(url, headers=headers)
            print(f"  状态: {resp.status_code}")
            if resp.status_code == 200:
                items = resp.json().get("data", resp.json().get("value", []))
                print(f"  结果: {len(items)} 个部署 ✓")
                for d in items:
                    print(
                        f"    - name={d.get('name')}, "
                        f"model={d.get('modelName')}, "
                        f"version={d.get('modelVersion')}, "
                        f"publisher={d.get('modelPublisher')}, "
                        f"sku={d.get('sku', {}).get('name')}"
                    )
                print("  结论: ✓ 这是正确的部署列表 API")
            else:
                print(f"  错误: {resp.text[:300]}")
        else:
            print("\n[测试 3] 跳过 — 未配置 AZURE_FOUNDRY_DEFAULT_PROJECT")

        # ---- 测试 4：验证单个部署是否存在 ----
        if PROJECT:
            items = resp.json().get("data", []) if resp.status_code == 200 else []
            if items:
                name = items[0].get("name", "gpt-4o-mini")
                print(f"\n[测试 4] 验证部署 '{name}' 是否可调用")
                url = f"{ENDPOINT}/openai/deployments/{name}/chat/completions?api-version=2024-10-21"
                resp = await client.post(
                    url,
                    headers=headers,
                    json={
                        "messages": [{"role": "user", "content": "hi"}],
                        "max_completion_tokens": 1,
                    },
                )
                print(f"  状态: {resp.status_code}")
                if resp.status_code in (200, 400):
                    print(f"  结论: ✓ 部署 '{name}' 存在且可调用")
                else:
                    error = resp.json().get("error", {})
                    print(f"  错误: {error.get('code')}: {error.get('message', '')[:120]}")

        # ---- 测试 5：验证不存在的部署 ----
        print("\n[测试 5] 验证不存在的部署 'nonexistent-model-xyz'")
        url = f"{ENDPOINT}/openai/deployments/nonexistent-model-xyz/chat/completions?api-version=2024-10-21"
        resp = await client.post(
            url,
            headers=headers,
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "max_completion_tokens": 1,
            },
        )
        print(f"  状态: {resp.status_code}")
        error = resp.json().get("error", {})
        print(f"  错误码: {error.get('code')}")
        if resp.status_code == 404:
            print("  结论: ✓ 不存在的部署正确返回 404 DeploymentNotFound")

    print("\n" + "=" * 70)
    print("测试完成")


if __name__ == "__main__":
    asyncio.run(main())
