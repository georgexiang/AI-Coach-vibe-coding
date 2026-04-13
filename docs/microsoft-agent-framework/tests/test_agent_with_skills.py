"""
Azure AI Foundry Agent + Skill 端到端 POC 验证

完整场景:
  1. 从 skills/ 目录加载真实的 SKILL.md（含 references/ 和 scripts/）
  2. 解析 SKILL.md frontmatter + body，读取 references，验证 scripts
  3. 将 Skill 内容 + Reference 内容组合为 Agent instructions
  4. 在 Azure AI Foundry 上创建 Agent（带 Skill instructions）
  5. 调用 Agent 对话，让它使用 Skill 处理真实的产品材料
  6. 用 scripts/validate_skill_output.py 验证 Agent 输出
  7. 清理测试 Agent

目录结构:
  tests/
    skills/
      mr-training-creator/
        SKILL.md                           # Skill 定义（frontmatter + instructions）
        references/
          product-zanubrutinib.md           # 产品参考资料
          hcp-objections.md                 # HCP 异议处理参考
        scripts/
          validate_skill_output.py          # 输出验证脚本

前置条件:
  1. backend/.env 中配置 AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY
  2. pip install azure-ai-projects>=2.0.1 python-frontmatter pyyaml

运行:
  cd backend
  .venv/bin/python3 ../docs/microsoft-agent-framework/tests/test_agent_with_skills.py
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import frontmatter

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------

TESTS_DIR = Path(__file__).resolve().parent
SKILLS_DIR = TESTS_DIR / "skills"
SKILL_DIR = SKILLS_DIR / "mr-training-creator"

backend_dir = TESTS_DIR.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")

ENDPOINT = os.getenv("AZURE_FOUNDRY_ENDPOINT", "").rstrip("/")
API_KEY = os.getenv("AZURE_FOUNDRY_API_KEY", "")
PROJECT_NAME = os.getenv("AZURE_FOUNDRY_DEFAULT_PROJECT", "avarda-demo-prj")
MODEL = os.getenv("AZURE_FOUNDRY_MODEL", "gpt-4o-mini")

AGENT_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$")
_created_agents: list[str] = []


# =============================================================================
# Helpers
# =============================================================================


def print_header(title: str):
    print(f"\n{'='*72}")
    print(f"  {title}")
    print(f"{'='*72}")


def print_result(success: bool, message: str):
    icon = "PASS" if success else "FAIL"
    print(f"  [{icon}] {message}")


def print_info(message: str):
    print(f"  INFO: {message}")


def _get_project_client():
    """Create an AIProjectClient using API Key authentication."""
    from azure.ai.projects import AIProjectClient
    from azure.core.credentials import AzureKeyCredential
    from azure.core.pipeline.policies import AzureKeyCredentialPolicy

    project_endpoint = f"{ENDPOINT}/api/projects/{PROJECT_NAME}"

    class _StubTokenCredential:
        def get_token(self, *_scopes, **_kwargs):
            from azure.core.credentials import AccessToken
            return AccessToken(token="stub", expires_on=0)

    client = AIProjectClient(
        endpoint=project_endpoint,
        credential=_StubTokenCredential(),
        authentication_policy=AzureKeyCredentialPolicy(
            credential=AzureKeyCredential(API_KEY),
            name="api-key",
        ),
    )
    return client


# =============================================================================
# Test 1: 加载真实 Skill 目录结构
# =============================================================================


def test_1_load_skill_directory():
    """验证 Skill 目录结构: SKILL.md + references/ + scripts/"""
    print_header("Test 1: 加载 Skill 目录结构")

    all_pass = True

    # --- Check directory structure ---
    skill_md_path = SKILL_DIR / "SKILL.md"
    refs_dir = SKILL_DIR / "references"
    scripts_dir = SKILL_DIR / "scripts"

    ok = skill_md_path.exists()
    print_result(ok, f"SKILL.md exists: {skill_md_path.relative_to(TESTS_DIR)}")
    if not ok:
        return False

    ok = refs_dir.is_dir()
    print_result(ok, f"references/ directory exists")
    if not ok:
        all_pass = False

    ok = scripts_dir.is_dir()
    print_result(ok, f"scripts/ directory exists")
    if not ok:
        all_pass = False

    # --- List references ---
    ref_files = sorted(refs_dir.glob("*.md"))
    ok = len(ref_files) >= 2
    print_result(ok, f"Found {len(ref_files)} reference files:")
    for f in ref_files:
        print_info(f"  - {f.name} ({f.stat().st_size} bytes)")

    # --- List scripts ---
    script_files = sorted(scripts_dir.glob("*.py"))
    ok = len(script_files) >= 1
    print_result(ok, f"Found {len(script_files)} script files:")
    for f in script_files:
        print_info(f"  - {f.name} ({f.stat().st_size} bytes)")

    # --- Parse SKILL.md frontmatter ---
    post = frontmatter.load(str(skill_md_path))
    fm = post.metadata
    body = post.content.strip()

    required = ["name", "description"]
    for field in required:
        ok = field in fm and fm[field]
        print_result(ok, f"Frontmatter field '{field}': {fm.get(field, '(missing)')[:60]}")
        if not ok:
            all_pass = False

    # Validate name is valid Azure agent name
    name = fm["name"]
    ok = bool(AGENT_NAME_PATTERN.match(name)) and len(name) <= 63
    print_result(ok, f"Skill name '{name}' is valid as Azure agent name")
    if not ok:
        all_pass = False

    ok = len(body) > 100
    print_result(ok, f"SKILL.md body: {len(body)} chars, {len(body.splitlines())} lines")

    return all_pass


# =============================================================================
# Test 2: 读取 references 并组合为 Agent instructions
# =============================================================================


def test_2_compose_instructions_with_references():
    """读取 SKILL.md + references/ 内容，组合完整的 Agent instructions."""
    print_header("Test 2: 组合 Skill + References 为 Agent Instructions")

    all_pass = True

    # Parse SKILL.md
    post = frontmatter.load(str(SKILL_DIR / "SKILL.md"))
    skill_body = post.content.strip()
    skill_name = post.metadata["name"]
    skill_desc = post.metadata["description"]

    # Read all reference files
    refs_dir = SKILL_DIR / "references"
    references = {}
    for ref_file in sorted(refs_dir.glob("*")):
        if ref_file.suffix in (".md", ".json", ".yaml", ".yml", ".csv", ".xml", ".txt"):
            content = ref_file.read_text(encoding="utf-8")
            references[ref_file.name] = content
            print_info(f"Loaded reference: {ref_file.name} ({len(content)} chars)")

    ok = len(references) >= 2
    print_result(ok, f"Loaded {len(references)} reference files")

    # Compose instructions (same pattern as skill_manager.compose_instructions)
    parts = []

    # Part 1: Skill instructions (SKILL.md body)
    parts.append(f"== Skill: {skill_name} ==\n{skill_desc}\n\n{skill_body}")

    # Part 2: Reference materials (injected into context)
    parts.append("\n\n== Reference Materials ==")
    parts.append("The following reference documents are available for this skill:\n")
    for filename, content in references.items():
        parts.append(f"### {filename}\n\n{content}")

    instructions = "\n\n".join(parts)

    ok = "ALPINE" in instructions  # clinical trial name from product reference
    print_result(ok, "Instructions contain clinical trial data (ALPINE)")

    ok = "objection" in instructions.lower()  # from HCP objections reference
    print_result(ok, "Instructions contain HCP objection data")

    ok = skill_name in instructions
    print_result(ok, f"Instructions contain skill name '{skill_name}'")

    token_estimate = len(instructions) // 4
    print_info(f"Composed instructions: {len(instructions)} chars (~{token_estimate} tokens)")

    ok = token_estimate < 10000  # reasonable size for a single skill
    print_result(ok, f"Token estimate {token_estimate} is within reasonable bounds (<10K)")

    # Store for later tests
    test_2_compose_instructions_with_references.instructions = instructions
    test_2_compose_instructions_with_references.skill_name = skill_name

    return all_pass


# =============================================================================
# Test 3: 验证 scripts/validate_skill_output.py 可执行
# =============================================================================


def test_3_run_validation_script():
    """运行 scripts/validate_skill_output.py 验证输出格式."""
    print_header("Test 3: 运行 Skill 验证脚本")

    all_pass = True
    script_path = SKILL_DIR / "scripts" / "validate_skill_output.py"

    # --- Test 3a: Compile check ---
    source = script_path.read_text(encoding="utf-8")
    try:
        compile(source, str(script_path), "exec")
        print_result(True, "Script compiles without errors")
    except SyntaxError as e:
        print_result(False, f"Script syntax error: {e}")
        return False

    # --- Test 3b: Valid complete output ---
    valid_output = json.dumps({
        "name": "zanubrutinib-cll-training",
        "description": "CLL/SLL training skill for BRUKINSA",
        "product": "BRUKINSA (zanubrutinib)",
        "therapeutic_area": "Oncology - Hematology",
        "key_messages": [
            "Superior ORR vs ibrutinib in ALPINE trial (78.3% vs 62.5%)",
            "Significantly lower atrial fibrillation rate (2.5% vs 10.1%)",
            "Available as both BID and QD dosing",
        ],
        "objection_handling": [
            {
                "objection": "I'm comfortable with ibrutinib",
                "response": "ALPINE showed superior ORR and lower cardiac events",
            },
            {
                "objection": "What about long-term data?",
                "response": "Consistent safety across ALPINE, ASPEN, SEQUOIA trials",
            },
        ],
        "clinical_data_summary": "ALPINE Phase 3 trial demonstrated superior ORR and PFS",
        "difficulty_level": "intermediate",
    })

    result = subprocess.run(
        [sys.executable, str(script_path), valid_output],
        capture_output=True, text=True, timeout=10,
    )
    ok = result.returncode == 0
    if ok:
        output = json.loads(result.stdout)
        print_result(True, f"Valid output accepted: score={output.get('score')}")
        ok = output.get("valid") is True and len(output.get("errors", [])) == 0
        print_result(ok, f"No errors, {len(output.get('warnings', []))} warnings")
    else:
        print_result(False, f"Script rejected valid output: {result.stderr}")
        all_pass = False

    # --- Test 3c: Incomplete output (missing required fields) ---
    incomplete = json.dumps({"name": "test", "key_messages": ["one"]})
    result2 = subprocess.run(
        [sys.executable, str(script_path), incomplete],
        capture_output=True, text=True, timeout=10,
    )
    output2 = json.loads(result2.stdout)
    ok = output2.get("valid") is False
    print_result(ok, f"Incomplete output rejected: {len(output2.get('errors', []))} errors")
    for err in output2.get("errors", []):
        print_info(f"  Error: {err}")
    if not ok:
        all_pass = False

    # --- Test 3d: Empty input ---
    result3 = subprocess.run(
        [sys.executable, str(script_path), ""],
        capture_output=True, text=True, timeout=10,
    )
    ok = result3.returncode != 0
    print_result(ok, "Empty input rejected")

    return all_pass


# =============================================================================
# Test 4: 在 Azure 创建带 Skill 的 Agent
# =============================================================================


def test_4_create_agent_with_skill():
    """在 Azure AI Foundry 上创建 Agent，instructions 包含完整 Skill + References."""
    print_header("Test 4: 创建带 Skill 的 Agent（Azure）")

    if not ENDPOINT or not API_KEY:
        print_info("Skipped: AZURE_FOUNDRY_ENDPOINT or AZURE_FOUNDRY_API_KEY not set")
        return None

    from azure.ai.projects.models import PromptAgentDefinition

    client = _get_project_client()

    # Use instructions composed in Test 2
    instructions = getattr(
        test_2_compose_instructions_with_references, "instructions", None
    )
    skill_name = getattr(
        test_2_compose_instructions_with_references, "skill_name", "mr-training-creator"
    )

    if not instructions:
        print_result(False, "No instructions available (Test 2 must run first)")
        return False

    agent_name = f"poc-{skill_name}"

    definition = PromptAgentDefinition(
        model=MODEL,
        instructions=instructions,
        tools=[],
    )

    try:
        result = client.agents.create_version(
            agent_name=agent_name,
            definition=definition,
            description=f"POC Agent with skill '{skill_name}' + references",
            metadata={
                "skill.name": skill_name,
                "skill.version": "1.0",
                "skill.refs": "product-zanubrutinib.md,hcp-objections.md",
            },
        )
        _created_agents.append(agent_name)

        ok = result.name == agent_name
        print_result(ok, f"Agent created: name={result.name}, version={result.version}")

        ok = result.version is not None
        print_result(ok, f"Version: {result.version}")

        # Store for Test 5
        test_4_create_agent_with_skill.agent_name = agent_name
        test_4_create_agent_with_skill.version = result.version

        print_info(f"Agent instructions length: {len(instructions)} chars")
        print_info(f"Metadata: skill.name={skill_name}")

        return True
    except Exception as e:
        print_result(False, f"Agent creation failed: {e}")
        return False


# =============================================================================
# Test 5: 调用 Agent 对话 — 使用 Skill 处理产品材料
# =============================================================================


def test_5_invoke_agent_with_skill():
    """调用 Agent 进行对话，让它使用 Skill 从产品材料生成结构化训练内容.

    Architecture note:
    - Agent 定义通过 AIProjectClient.agents.create_version() 创建（Test 4）
    - Agent 对话通过 Responses API (client.get_openai_client().responses.create())
      + agent_reference extra_body 进行
    - 两者是独立的 API 层：Agent Registry (CRUD) vs Responses API (对话)
    """
    print_header("Test 5: 调用 Agent 对话 — 使用 Skill（Azure）")

    if not ENDPOINT or not API_KEY:
        print_info("Skipped: AZURE_FOUNDRY_ENDPOINT or AZURE_FOUNDRY_API_KEY not set")
        return None

    agent_name = getattr(test_4_create_agent_with_skill, "agent_name", None)
    agent_version = getattr(test_4_create_agent_with_skill, "version", "1")
    if not agent_name:
        print_info("Skipped: Test 4 must create agent first")
        return None

    client = _get_project_client()
    # Pass api_key explicitly — get_openai_client() defaults to Entra ID bearer token,
    # but our POC uses API Key auth
    openai_client = client.get_openai_client(api_key=API_KEY)

    # User message — asks the agent to use the skill with the product material
    user_message = (
        "Please create a structured MR training skill from the Zanubrutinib "
        "(BRUKINSA) product materials provided in your reference documents. "
        "Focus on the CLL/SLL indication and the ALPINE trial data. "
        "Return the result as a JSON object following the output format specified."
    )

    # agent_reference tells the Responses API to use the registered Agent
    extra_body = {
        "agent_reference": {
            "name": agent_name,
            "version": str(agent_version),
            "type": "agent_reference",
        }
    }

    try:
        print_info(f"Calling Agent '{agent_name}' v{agent_version} via Responses API...")
        print_info(f"User message: {user_message[:80]}...")

        response = openai_client.responses.create(
            model=MODEL,
            input=[{"role": "user", "content": user_message}],
            extra_body=extra_body,
        )

        # Extract response text
        response_text = response.output_text
        ok = len(response_text) > 100
        print_result(ok, f"Agent responded: {len(response_text)} chars")
        print_info(f"Response preview: {response_text[:300]}...")

        # Check if response references the skill content (from references/)
        response_lower = response_text.lower()

        ok = "zanubrutinib" in response_lower or "brukinsa" in response_lower
        print_result(ok, "Response mentions Zanubrutinib/BRUKINSA (from references)")

        ok = "alpine" in response_lower
        print_result(ok, "Response references ALPINE trial (from references)")

        # Check for JSON output (the skill instructs to return JSON)
        has_json = "{" in response_text and "}" in response_text
        print_result(has_json, "Response contains JSON structure")

        # Store response for Test 6 validation
        test_5_invoke_agent_with_skill.response_text = response_text

        return True

    except Exception as e:
        print_result(False, f"Agent invocation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


# =============================================================================
# Test 6: 用验证脚本检查 Agent 输出
# =============================================================================


def test_6_validate_agent_output_with_script():
    """用 scripts/validate_skill_output.py 验证 Agent 产出的 JSON."""
    print_header("Test 6: 用验证脚本检查 Agent 输出")

    response_text = getattr(test_5_invoke_agent_with_skill, "response_text", None)
    if not response_text:
        print_info("Skipped: Test 5 must produce a response first")
        return None

    # Try to extract JSON from response
    json_data = None

    # Attempt 1: look for ```json ... ``` block
    json_block_match = re.search(r"```json\s*\n(.*?)\n\s*```", response_text, re.DOTALL)
    if json_block_match:
        try:
            json_data = json.loads(json_block_match.group(1))
            print_info("Extracted JSON from markdown code block")
        except json.JSONDecodeError:
            pass

    # Attempt 2: try parsing the entire response as JSON
    if json_data is None:
        try:
            json_data = json.loads(response_text)
            print_info("Parsed entire response as JSON")
        except json.JSONDecodeError:
            pass

    # Attempt 3: find first { ... } in response
    if json_data is None:
        brace_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if brace_match:
            try:
                json_data = json.loads(brace_match.group(0))
                print_info("Extracted JSON from brace-delimited block")
            except json.JSONDecodeError:
                pass

    if json_data is None:
        print_result(False, "Could not extract JSON from agent response")
        print_info(f"Response (first 500 chars): {response_text[:500]}")
        return False

    print_result(True, f"Extracted JSON with {len(json_data)} fields")

    # Print extracted fields
    for key in ["name", "description", "product", "therapeutic_area"]:
        val = json_data.get(key, "(missing)")
        if isinstance(val, str) and len(val) > 60:
            val = val[:60] + "..."
        print_info(f"  {key}: {val}")

    messages = json_data.get("key_messages", [])
    print_info(f"  key_messages: {len(messages)} items")

    objections = json_data.get("objection_handling", [])
    print_info(f"  objection_handling: {len(objections)} items")

    # Run the validation script
    script_path = SKILL_DIR / "scripts" / "validate_skill_output.py"
    json_str = json.dumps(json_data)

    result = subprocess.run(
        [sys.executable, str(script_path), json_str],
        capture_output=True, text=True, timeout=10,
    )

    try:
        validation = json.loads(result.stdout)
    except json.JSONDecodeError:
        print_result(False, f"Validation script output is not JSON: {result.stdout}")
        return False

    ok = validation.get("valid", False)
    print_result(ok, f"Validation: valid={ok}, score={validation.get('score')}")

    errors = validation.get("errors", [])
    for err in errors:
        print_info(f"  ERROR: {err}")

    warnings = validation.get("warnings", [])
    for warn in warnings:
        print_info(f"  WARNING: {warn}")

    return ok


# =============================================================================
# Cleanup
# =============================================================================


def cleanup():
    """Delete all test agents created during this run."""
    if not _created_agents:
        return

    print_header("Cleanup: Deleting test agents")
    client = _get_project_client()

    for name in _created_agents:
        try:
            client.agents.delete(agent_name=name)
            print_result(True, f"Deleted: {name}")
        except Exception as e:
            print_result(False, f"Failed to delete {name}: {e}")


# =============================================================================
# Main
# =============================================================================


def main():
    print("=" * 72)
    print("  Azure AI Foundry Agent + Skill 端到端 POC")
    print("  Skill: mr-training-creator (SKILL.md + references/ + scripts/)")
    print("=" * 72)

    if ENDPOINT:
        print_info(f"Endpoint: {ENDPOINT}")
        print_info(f"Project: {PROJECT_NAME}")
        print_info(f"Model: {MODEL}")
    else:
        print_info("No Azure credentials — only running local tests (1-3)")

    print_info(f"Skill dir: {SKILL_DIR.relative_to(TESTS_DIR)}")

    results = {}

    # Local tests (always run, no Azure needed)
    results["Test 1: Load Skill Directory"] = test_1_load_skill_directory()
    results["Test 2: Compose Instructions"] = test_2_compose_instructions_with_references()
    results["Test 3: Run Validation Script"] = test_3_run_validation_script()

    # Azure tests (require credentials)
    results["Test 4: Create Agent with Skill"] = test_4_create_agent_with_skill()
    results["Test 5: Invoke Agent (Use Skill)"] = test_5_invoke_agent_with_skill()
    results["Test 6: Validate Agent Output"] = test_6_validate_agent_output_with_script()

    # Cleanup
    if _created_agents:
        try:
            cleanup()
        except Exception as e:
            print_info(f"Cleanup error (non-fatal): {e}")

    # Summary
    print_header("Summary")
    for test_name, ok in results.items():
        if ok is None:
            status = "SKIP"
        elif ok:
            status = "PASS"
        else:
            status = "FAIL"
        print(f"  [{status}] {test_name}")

    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    passed = sum(1 for v in results.values() if v is True)
    print(f"\n  Total: {passed} passed, {failed} failed, {skipped} skipped")

    if passed == 6:
        print("\n  End-to-end flow:")
        print("    SKILL.md loaded → references/ read → instructions composed")
        print("    → Agent created on Azure → Agent invoked with user query")
        print("    → Agent used skill + references to generate output")
        print("    → scripts/validate_skill_output.py validated the result")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
