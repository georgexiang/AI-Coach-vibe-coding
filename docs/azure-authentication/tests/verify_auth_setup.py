"""验证 Azure 认证配置的独立脚本。

用法:
    cd backend
    source .venv/bin/activate
    python ../docs/azure-authentication/tests/verify_auth_setup.py

此脚本验证:
1. azure-identity 包是否安装
2. az login 是否有效
3. DefaultAzureCredential 能否获取 token
4. Azure OpenAI 客户端能否创建
5. 可选: 实际调用 Azure OpenAI 验证端到端

注意: 此脚本不依赖后端应用代码，可独立运行。
"""

import asyncio
import sys


async def check_azure_identity():
    """Check if azure-identity is installed."""
    try:
        import azure.identity  # noqa: F401

        print(f"  ✓ azure-identity installed (version: {azure.identity.__version__})")
        return True
    except ImportError:
        print("  ✗ azure-identity NOT installed")
        print("    Fix: pip install azure-identity>=1.17.0")
        return False


async def check_az_login():
    """Check if az login is valid."""
    import subprocess

    try:
        result = subprocess.run(
            ["az", "account", "show", "--query", "user.name", "-o", "tsv"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            print(f"  ✓ az login active (user: {result.stdout.strip()})")
            return True
        else:
            print("  ✗ az login not active")
            print("    Fix: az login")
            return False
    except FileNotFoundError:
        print("  ✗ Azure CLI not installed")
        print("    Fix: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli")
        return False
    except subprocess.TimeoutExpired:
        print("  ✗ az command timed out")
        return False


async def check_credential():
    """Check if DefaultAzureCredential can get a token."""
    try:
        from azure.identity.aio import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")
        await credential.close()

        if token and token.token:
            print(f"  ✓ AAD token obtained (length: {len(token.token)}, expires: {token.expires_on})")
            return True
        else:
            print("  ✗ Token is empty")
            return False
    except Exception as e:
        print(f"  ✗ Failed to get token: {type(e).__name__}: {e}")
        return False


async def check_openai_client(endpoint: str = "", api_key: str = ""):
    """Check if Azure OpenAI client can be created."""
    if not endpoint:
        print("  ⊘ Skipped (no endpoint provided)")
        print("    Provide --endpoint to test client creation")
        return None

    try:
        # Try using the centralized module first
        sys.path.insert(0, ".")
        from app.services.azure_auth import get_azure_openai_client

        client = await get_azure_openai_client(endpoint, api_key)
        print(f"  ✓ Client created: {type(client).__name__}")
        return True
    except ImportError:
        # Fallback: test without app module
        try:
            from azure.identity.aio import DefaultAzureCredential
            from openai import AsyncAzureOpenAI

            credential = DefaultAzureCredential()
            token = await credential.get_token("https://cognitiveservices.azure.com/.default")
            await credential.close()

            client = AsyncAzureOpenAI(
                azure_endpoint=endpoint,
                azure_ad_token=token.token,
                api_version="2024-06-01",
            )
            print(f"  ✓ Client created (standalone): {type(client).__name__}")
            return True
        except Exception as e:
            print(f"  ✗ Client creation failed: {e}")
            return False
    except RuntimeError as e:
        print(f"  ✗ No credentials: {e}")
        return False
    except Exception as e:
        print(f"  ✗ Unexpected error: {type(e).__name__}: {e}")
        return False


async def check_e2e(endpoint: str, deployment: str, api_key: str = ""):
    """End-to-end test: actually call Azure OpenAI."""
    if not endpoint or not deployment:
        print("  ⊘ Skipped (no endpoint/deployment provided)")
        print("    Provide --endpoint and --deployment to test E2E")
        return None

    try:
        sys.path.insert(0, ".")
        from app.services.azure_auth import get_azure_openai_client

        client = await get_azure_openai_client(endpoint, api_key)
        response = await client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": "Say 'hello' in one word."}],
            max_tokens=5,
        )
        content = response.choices[0].message.content
        print(f"  ✓ E2E call succeeded! Response: '{content}'")
        return True
    except Exception as e:
        print(f"  ✗ E2E call failed: {type(e).__name__}: {e}")
        return False


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Verify Azure auth setup")
    parser.add_argument("--endpoint", default="", help="Azure OpenAI endpoint URL")
    parser.add_argument("--deployment", default="", help="Model deployment name")
    parser.add_argument("--api-key", default="", help="Fallback API key")
    args = parser.parse_args()

    print("=" * 60)
    print("  Azure 认证配置验证")
    print("=" * 60)
    print()

    results = {}

    print("[1/5] 检查 azure-identity 包...")
    results["azure-identity"] = await check_azure_identity()
    print()

    print("[2/5] 检查 az login 状态...")
    results["az-login"] = await check_az_login()
    print()

    print("[3/5] 检查 DefaultAzureCredential Token...")
    results["credential"] = await check_credential()
    print()

    print("[4/5] 检查 Azure OpenAI Client 创建...")
    results["client"] = await check_openai_client(args.endpoint, args.api_key)
    print()

    print("[5/5] 端到端调用测试...")
    results["e2e"] = await check_e2e(args.endpoint, args.deployment, args.api_key)
    print()

    # Summary
    print("=" * 60)
    print("  结果汇总")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    print(f"  通过: {passed}  失败: {failed}  跳过: {skipped}")
    print()

    if failed > 0:
        print("  ⚠️  存在认证问题，请按上方提示修复")
        sys.exit(1)
    else:
        print("  ✓ 认证配置正常！")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
