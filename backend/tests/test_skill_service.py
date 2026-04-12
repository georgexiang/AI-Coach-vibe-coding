"""Skill service tests: CRUD, full lifecycle transitions, file security.

Uses realistic BeiGene product data (Zanubrutinib/Tislelizumab) to test
every skill status: draft → review → published → archived, failed → draft.
Target: 100% coverage of app/services/skill_service.py
"""

import json

import pytest

from app.models.skill import VALID_TRANSITIONS, Skill
from app.schemas.skill import SkillCreate, SkillUpdate
from app.services.skill_service import (
    sanitize_filename,
    validate_file_upload,
    validate_status_transition,
)
from app.services.skill_validation_service import _compute_content_hash
from app.utils.exceptions import NotFoundException, ValidationException
from tests.conftest import TestSessionLocal

# ---------------------------------------------------------------------------
# Realistic BeiGene product data
# ---------------------------------------------------------------------------

ZANUBRUTINIB_CONTENT = """# 泽布替尼 (Zanubrutinib/BRUKINSA®) F2F拜访技能 - Coaching Protocol

## Overview

泽布替尼(BRUKINSA®)是百济神州自主研发的新一代布鲁顿酪氨酸激酶(BTK)抑制剂，\
已获得FDA批准的5项适应症，是同类药物中适应症最广的BTK抑制剂。\
本技能培训MR如何在F2F拜访中向血液科HCP介绍泽布替尼治疗CLL/SLL的临床优势。

## SOP Steps

### Step 1: Opening — 建立专业信任

开场白：问候HCP并确认其在CLL/SLL领域的临床经验。
使用ALPINE研究数据引起兴趣，展示泽布替尼 vs 伊布替尼的头对头优势。

**Key Points:**
- BRUKINSA是唯一在III期研究中证明优于另一BTK抑制剂的产品
- 全球已有超过20万名患者接受治疗
- 在美国CLL新患者处方量排名第一

**Common Objections:**
- "我的患者用伊布替尼效果不错，为什么要换？" → 引用ALPINE研究：泽布替尼ORR更高(78.3% vs 62.5%)
- "安全性数据如何？" → 房颤发生率显著更低(2.5% vs 10.1%)

**Assessment Criteria:**
- 能否在30秒内清晰传递泽布替尼的核心差异化价值
- 是否使用了ALPINE III期数据支持论点

**Knowledge Points:**
- BTK 100%抑制：血液中100%，淋巴结94-100%
- 推荐总日剂量320mg，支持每日一次或每日两次灵活给药

**Suggested Duration:** 2-3 minutes

### Step 2: Discussion — 产品临床数据呈现

深入介绍泽布替尼在各适应症的关键临床数据。

**Key Points:**
- CLL/SLL: SEQUOIA研究 — 初治CLL一线治疗
- WM: ASPEN研究 — 华氏巨球蛋白血症
- MCL: 套细胞淋巴瘤二线治疗
- FL: 联合obinutuzumab治疗复发/难治滤泡性淋巴瘤
- MZL: 边缘区淋巴瘤

**Common Objections:**
- "与venetoclax联合方案相比如何？" → 正在进行CELESTIAL-TNCLL研究
- "长期安全性数据？" → 已有超过5年随访数据，安全性特征一致

**Assessment Criteria:**
- 是否能针对HCP专科方向选择合适的临床数据
- 是否准确引用关键研究名称和数据

**Knowledge Points:**
- ALPINE: 泽布替尼 vs 伊布替尼 (R/R CLL/SLL)
- SEQUOIA: 泽布替尼 vs 苯达莫司汀+利妥昔单抗 (初治CLL)
- ASPEN: 泽布替尼 vs 伊布替尼 (WM)

**Suggested Duration:** 5-7 minutes

### Step 3: Closing — 促成处方决策

总结泽布替尼的核心优势，提出明确的行动建议。

**Key Points:**
- 强调差异化优势：更高疗效、更低房颤风险、灵活给药方案
- 新片剂制剂即将上市，进一步减轻药片负担
- 提供患者支持项目信息

**Common Objections:**
- "我需要更多时间考虑" → 提供临床文献资料，预约下次拜访
- "价格是否有竞争力？" → 介绍患者援助项目和医保覆盖情况

**Assessment Criteria:**
- 是否给出明确的处方建议
- 是否安排了后续跟进计划

**Knowledge Points:**
- 2025年FDA批准新片剂制剂，适用于所有5项适应症
- 全球75+个市场获批

**Suggested Duration:** 2-3 minutes

## Assessment Rubric

| Criterion | Description | Weight |
|-----------|-------------|--------|
| 关键信息传递 | 清晰传递BRUKINSA核心差异化信息 | 30% |
| 异议处理 | 有效应对HCP临床疑虑 | 25% |
| 产品知识 | 准确引用临床研究数据 | 25% |
| 沟通技巧 | 专业、自信、以患者为中心 | 20% |

## Key Knowledge Points

### BTK抑制机制
泽布替尼通过抑制BTK蛋白阻断B细胞恶性增殖信号。BTK蛋白向癌变B细胞持续发送生长扩散信号，\
泽布替尼设计为全天候阻断BTK信号传导。

### ALPINE III期研究
头对头比较泽布替尼与伊布替尼治疗复发/难治CLL/SLL。\
主要终点：ORR (78.3% vs 62.5%, p<0.001)。\
安全性优势：房颤发生率显著降低(2.5% vs 10.1%)。

### 五项FDA批准适应症
1. 慢性淋巴细胞白血病/小淋巴细胞淋巴瘤 (CLL/SLL)
2. 华氏巨球蛋白血症 (WM)
3. 套细胞淋巴瘤 (MCL) — 至少一线治疗后
4. 复发/难治边缘区淋巴瘤 (MZL)
5. 复发/难治滤泡性淋巴瘤 (FL) — 联合obinutuzumab
"""

TISLELIZUMAB_CONTENT = """# 替雷利珠单抗 (Tislelizumab/TEVIMBRA®) 学术会议技能 - Coaching Protocol

## Overview

替雷利珠单抗(TEVIMBRA®)是百济神州自主研发的人源化IgG4抗PD-1单克隆抗体，\
已在全球46个市场获批，超过150万名患者接受治疗。\
本技能培训MR如何在学术会议中介绍替雷利珠单抗在实体瘤领域的临床进展。

## SOP Steps

### Step 1: Opening — 学术背景介绍

介绍替雷利珠单抗独特的分子设计和全球临床开发进展。

**Key Points:**
- 独特IgG4设计：最大化抑制PD-1与PD-L1结合，最小化Fcγ受体结合
- 全球临床开发：近14,000名患者入组，35个国家/地区，70项临床试验
- 21项注册研究支持

**Common Objections:**
- "和其他PD-1抑制剂有什么区别？" → Fcγ受体结合最小化设计，减少T细胞耗竭
- "临床数据量够吗？" → 70项临床试验，近14,000名患者

**Assessment Criteria:**
- 能否清晰解释替雷利珠单抗的分子设计优势
- 是否准确介绍全球开发规模

**Knowledge Points:**
- IgG4亚型设计减少ADCC/CDC效应
- Fcγ受体结合最小化有助于维持T细胞活性

**Suggested Duration:** 3-4 minutes

### Step 2: Discussion — 适应症数据

详细介绍替雷利珠单抗在各癌种的临床数据。

**Key Points:**
- ESCC一线: RATIONALE-306研究，联合化疗 vs 安慰剂
  - PD-L1阳性患者mOS 16.8 vs 9.6个月 (HR 0.66)
- NSCLC: RATIONALE-303/304研究
- HCC: 单药治疗
- cHL: 经典霍奇金淋巴瘤

**Common Objections:**
- "ESCC的治疗格局已经很拥挤了" → 替雷利珠单抗联合方案在PD-L1+患者中降低34%死亡风险
- "二三线NSCLC有何数据？" → RATIONALE-303研究显示显著OS获益

**Assessment Criteria:**
- 是否能根据听众专科选择合适的适应症数据
- 是否准确引用关键研究结果

**Knowledge Points:**
- RATIONALE-306: 食管鳞癌一线治疗
- RATIONALE-303: NSCLC二/三线治疗
- RATIONALE-213: 新辅助可切除ESCC (PET指导方案)

**Suggested Duration:** 5-8 minutes

### Step 3: Closing — 未来展望

总结替雷利珠单抗的临床价值和管线进展。

**Key Points:**
- 已获批适应症持续扩展
- 联合治疗探索（与ANKTIVA联合治疗NSCLC的III期研究）
- 全球可及性：46个市场获批

**Common Objections:**
- "何时有更多适应症数据？" → 2025年ASCO将公布多项关键研究更新

**Assessment Criteria:**
- 是否传达了对未来发展的信心
- 是否安排了后续学术交流

**Knowledge Points:**
- ResQ201A-NSCLC: 联合ANKTIVA治疗耐药NSCLC
- 2025年ASCO关键数据公布

**Suggested Duration:** 2-3 minutes

## Assessment Rubric

| Criterion | Description | Weight |
|-----------|-------------|--------|
| 学术专业性 | 准确传递临床研究数据 | 30% |
| 差异化定位 | 清晰阐述产品竞争优势 | 25% |
| 适应症覆盖 | 全面介绍获批和在研适应症 | 25% |
| 互动沟通 | 有效回应听众问题 | 20% |

## Key Knowledge Points

### PD-1抑制剂机制
替雷利珠单抗通过阻断PD-1与PD-L1的结合，恢复T细胞对肿瘤的免疫监视功能。\
其IgG4亚型设计减少了不必要的免疫效应，有助于维持抗肿瘤T细胞活性。

### RATIONALE系列研究
- RATIONALE-301: HCC一线治疗
- RATIONALE-303: NSCLC二/三线治疗
- RATIONALE-306: ESCC一线治疗（PD-L1+ mOS 16.8 vs 9.6月）
- RATIONALE-213: 新辅助ESCC

### 全球获批适应症
中国NMPA：cHL, UC, NSCLC(联合化疗), HCC, NSCLC(二/三线), ESCC
美国FDA：ESCC一线(PD-L1+联合化疗, 2025年3月获批)
"""


# ---------------------------------------------------------------------------
# Helper: create test admin user
# ---------------------------------------------------------------------------


async def _seed_user() -> str:
    """Create a test admin user and return the user_id."""
    from app.models.user import User
    from app.services.auth import get_password_hash

    async with TestSessionLocal() as session:
        user = User(
            username="skill_test_admin",
            email="skill_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Skill Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


async def _create_zanubrutinib_skill(db_session, user_id: str) -> Skill:
    """Create a Zanubrutinib skill with realistic content."""
    from app.services import skill_service

    data = SkillCreate(
        name="泽布替尼 F2F拜访技能",
        description="训练MR使用ALPINE研究数据向血液科HCP介绍BRUKINSA治疗CLL/SLL的核心优势",
        product="Zanubrutinib",
        therapeutic_area="Oncology / Hematology",
        content=ZANUBRUTINIB_CONTENT,
        tags="BTK,CLL,SLL,WM,MCL,MZL,FL,ALPINE,SEQUOIA,ASPEN",
    )
    skill = await skill_service.create_skill(db_session, data, user_id)
    await db_session.commit()
    return skill


async def _create_tislelizumab_skill(db_session, user_id: str) -> Skill:
    """Create a Tislelizumab skill with realistic content."""
    from app.services import skill_service

    data = SkillCreate(
        name="替雷利珠单抗 学术会议技能",
        description="训练MR在学术会议中介绍TEVIMBRA在实体瘤领域的最新临床进展和竞争优势",
        product="Tislelizumab",
        therapeutic_area="Oncology / Immunotherapy",
        content=TISLELIZUMAB_CONTENT,
        tags="PD-1,ESCC,NSCLC,HCC,cHL,RATIONALE",
    )
    skill = await skill_service.create_skill(db_session, data, user_id)
    await db_session.commit()
    return skill


async def _advance_to_review(db_session, skill_id: str, user_id: str) -> Skill:
    """Move skill from draft → review."""
    from app.services import skill_service

    updated = await skill_service.update_skill(
        db_session, skill_id, SkillUpdate(status="review"), user_id
    )
    await db_session.commit()
    return updated


async def _set_quality_gates(db_session, skill, score: int = 75):
    """Set quality gates to allow publishing."""
    skill.structure_check_passed = True
    skill.quality_score = score
    skill.quality_verdict = "PASS" if score >= 70 else "NEEDS_REVIEW"
    skill.quality_details = json.dumps(
        {"content_hash": _compute_content_hash(skill.content or "")}
    )
    await db_session.flush()


# ===========================================================================
# Test classes
# ===========================================================================


class TestCreateSkill:
    """Test skill creation with realistic BeiGene data."""

    async def test_create_zanubrutinib_skill_returns_draft(self, db_session):
        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)

        assert skill.id is not None
        assert skill.name == "泽布替尼 F2F拜访技能"
        assert skill.product == "Zanubrutinib"
        assert skill.therapeutic_area == "Oncology / Hematology"
        assert skill.status == "draft"
        assert skill.current_version == 1
        assert skill.created_by == user_id
        assert "ALPINE" in skill.content

    async def test_create_tislelizumab_skill_with_initial_version(self, db_session):
        user_id = await _seed_user()
        skill = await _create_tislelizumab_skill(db_session, user_id)

        assert skill.status == "draft"
        assert skill.product == "Tislelizumab"
        assert len(skill.versions) == 1
        assert skill.versions[0].version_number == 1
        assert skill.versions[0].is_published is False

    async def test_create_skill_with_minimal_data(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        data = SkillCreate(name="Minimal Skill")
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.commit()

        assert skill.name == "Minimal Skill"
        assert skill.description == ""
        assert skill.product == ""
        assert skill.status == "draft"


class TestGetSkills:
    """Test skill retrieval with filters and pagination."""

    async def test_get_skills_no_filter(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        await _create_zanubrutinib_skill(db_session, user_id)
        await _create_tislelizumab_skill(db_session, user_id)

        items, total = await skill_service.get_skills(db_session)
        assert total == 2
        assert len(items) == 2

    async def test_get_skills_filter_by_status(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        await _create_zanubrutinib_skill(db_session, user_id)
        skill2 = await _create_tislelizumab_skill(db_session, user_id)
        # Move tislelizumab to review
        await _advance_to_review(db_session, skill2.id, user_id)

        items_draft, total_draft = await skill_service.get_skills(db_session, status="draft")
        assert total_draft == 1
        assert items_draft[0].product == "Zanubrutinib"

        items_review, total_review = await skill_service.get_skills(db_session, status="review")
        assert total_review == 1
        assert items_review[0].product == "Tislelizumab"

    async def test_get_skills_filter_by_product(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        await _create_zanubrutinib_skill(db_session, user_id)
        await _create_tislelizumab_skill(db_session, user_id)

        items, total = await skill_service.get_skills(db_session, product="Zanubrutinib")
        assert total == 1
        assert items[0].name == "泽布替尼 F2F拜访技能"

    async def test_get_skills_filter_by_search(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        await _create_zanubrutinib_skill(db_session, user_id)
        await _create_tislelizumab_skill(db_session, user_id)

        items, total = await skill_service.get_skills(db_session, search="TEVIMBRA")
        assert total == 1
        assert items[0].product == "Tislelizumab"

    async def test_get_skills_pagination(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        await _create_zanubrutinib_skill(db_session, user_id)
        await _create_tislelizumab_skill(db_session, user_id)

        items, total = await skill_service.get_skills(db_session, page=1, page_size=1)
        assert total == 2
        assert len(items) == 1

        items_p2, _ = await skill_service.get_skills(db_session, page=2, page_size=1)
        assert len(items_p2) == 1

    async def test_get_published_skills_empty_when_all_draft(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        await _create_zanubrutinib_skill(db_session, user_id)

        items, total = await skill_service.get_published_skills(db_session)
        assert total == 0
        assert items == []

    async def test_get_published_skills_returns_only_published(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        # Refresh skill reference after commit
        skill = await skill_service.get_skill(db_session, skill.id)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()

        items, total = await skill_service.get_published_skills(db_session)
        assert total == 1
        assert items[0].name == "泽布替尼 F2F拜访技能"

    async def test_get_published_skills_with_search(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()

        items, total = await skill_service.get_published_skills(db_session, search="不存在的关键词")
        assert total == 0


class TestGetSkillById:
    """Test single skill retrieval."""

    async def test_get_skill_success(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        created = await _create_zanubrutinib_skill(db_session, user_id)
        skill = await skill_service.get_skill(db_session, created.id)

        assert skill.id == created.id
        assert skill.name == "泽布替尼 F2F拜访技能"

    async def test_get_skill_not_found(self, db_session):
        from app.services import skill_service

        with pytest.raises(NotFoundException):
            await skill_service.get_skill(db_session, "nonexistent-id")


class TestUpdateSkill:
    """Test skill metadata updates and status transitions."""

    async def test_update_skill_metadata(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)

        updated = await skill_service.update_skill(
            db_session,
            skill.id,
            SkillUpdate(
                name="泽布替尼 F2F拜访技能 v2",
                description="更新后的描述",
            ),
            user_id,
        )
        await db_session.commit()

        assert updated.name == "泽布替尼 F2F拜访技能 v2"
        assert updated.description == "更新后的描述"
        assert updated.updated_by == user_id

    async def test_update_skill_status_draft_to_review(self, db_session):
        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)

        updated = await _advance_to_review(db_session, skill.id, user_id)
        assert updated.status == "review"

    async def test_update_skill_invalid_status_transition(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)

        with pytest.raises(ValidationException, match="Invalid status transition"):
            await skill_service.update_skill(
                db_session, skill.id, SkillUpdate(status="published"), user_id
            )


class TestDeleteSkill:
    """Test skill deletion: only draft/failed skills can be deleted."""

    async def test_delete_draft_skill(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        skill_id = skill.id

        await skill_service.delete_skill(db_session, skill_id)
        await db_session.commit()

        with pytest.raises(NotFoundException):
            await skill_service.get_skill(db_session, skill_id)

    async def test_delete_review_skill_rejected(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_tislelizumab_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)

        with pytest.raises(ValidationException, match="Cannot delete"):
            await skill_service.delete_skill(db_session, skill.id)

    async def test_delete_skill_with_resources(self):
        """Delete a draft skill that has attached resources (best-effort file cleanup)."""
        from app.models.skill import SkillResource
        from app.services import skill_service

        user_id = await _seed_user()

        # Use a fresh session so identity map starts clean
        async with TestSessionLocal() as s:
            data = SkillCreate(
                name="泽布替尼资料Skill",
                product="Zanubrutinib",
                content="test content",
            )
            skill = await skill_service.create_skill(s, data, user_id)
            sid = skill.id

            # Add resource in the same transaction
            resource = SkillResource(
                skill_id=sid,
                resource_type="reference",
                filename="zanubrutinib_training_manual_v1.pdf",
                storage_path=f"skills/{sid}/references/zanubrutinib_training_manual_v1.pdf",
                content_type="application/pdf",
                file_size=2048000,
            )
            s.add(resource)
            await s.flush()
            await s.commit()

        # Fresh session for deletion — identity map is clean, resources will be loaded
        async with TestSessionLocal() as s:
            await skill_service.delete_skill(s, sid)
            await s.commit()

        async with TestSessionLocal() as s:
            with pytest.raises(NotFoundException):
                await skill_service.get_skill(s, sid)

    async def test_delete_failed_skill_with_resources(self):
        """Failed skills with resources can also be deleted."""
        from app.models.skill import SkillResource
        from app.services import skill_service

        user_id = await _seed_user()

        async with TestSessionLocal() as s:
            data = SkillCreate(
                name="替雷利珠单抗资料Skill",
                product="Tislelizumab",
                content="test content",
            )
            skill = await skill_service.create_skill(s, data, user_id)
            skill.status = "failed"
            sid = skill.id

            resource = SkillResource(
                skill_id=sid,
                resource_type="reference",
                filename="tislelizumab_data.pdf",
                storage_path=f"skills/{sid}/references/tislelizumab_data.pdf",
                content_type="application/pdf",
                file_size=1024000,
            )
            s.add(resource)
            await s.flush()
            await s.commit()

        async with TestSessionLocal() as s:
            await skill_service.delete_skill(s, sid)
            await s.commit()

        async with TestSessionLocal() as s:
            with pytest.raises(NotFoundException):
                await skill_service.get_skill(s, sid)

    async def test_delete_skill_storage_error_ignored(self):
        """Storage delete failure is silently ignored (best-effort cleanup, covers L241-242)."""
        from unittest.mock import AsyncMock, patch

        from app.models.skill import SkillResource
        from app.services import skill_service

        user_id = await _seed_user()

        async with TestSessionLocal() as s:
            data = SkillCreate(
                name="Storage异常测试Skill",
                product="Zanubrutinib",
                content="test content for storage error",
            )
            skill = await skill_service.create_skill(s, data, user_id)
            sid = skill.id

            resource = SkillResource(
                skill_id=sid,
                resource_type="reference",
                filename="will_fail_delete.pdf",
                storage_path=f"skills/{sid}/references/will_fail_delete.pdf",
                content_type="application/pdf",
                file_size=1024,
            )
            s.add(resource)
            await s.flush()
            await s.commit()

        # Mock storage.delete to raise an exception
        mock_storage = AsyncMock()
        mock_storage.delete = AsyncMock(side_effect=OSError("disk I/O error"))

        async with TestSessionLocal() as s:
            with patch("app.services.storage.get_storage", return_value=mock_storage):
                await skill_service.delete_skill(s, sid)
                await s.commit()

        # Skill should still be deleted despite storage error
        async with TestSessionLocal() as s:
            with pytest.raises(NotFoundException):
                await skill_service.get_skill(s, sid)

    async def test_delete_published_skill_rejected(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()

        with pytest.raises(ValidationException, match="Cannot delete"):
            await skill_service.delete_skill(db_session, skill.id)


class TestStatusTransitions:
    """Test lifecycle state machine transitions (validation function)."""

    def test_valid_transitions_all_succeed(self):
        for from_state, to_states in VALID_TRANSITIONS.items():
            for to_state in to_states:
                validate_status_transition(from_state, to_state)

    def test_invalid_transition_draft_to_published(self):
        with pytest.raises(ValidationException):
            validate_status_transition("draft", "published")

    def test_invalid_transition_published_to_draft(self):
        with pytest.raises(ValidationException):
            validate_status_transition("published", "draft")

    def test_invalid_transition_archived_to_published(self):
        with pytest.raises(ValidationException):
            validate_status_transition("archived", "published")

    def test_invalid_transition_draft_to_archived(self):
        with pytest.raises(ValidationException):
            validate_status_transition("draft", "archived")

    def test_invalid_transition_review_to_archived(self):
        with pytest.raises(ValidationException):
            validate_status_transition("review", "archived")

    def test_invalid_transition_unknown_state(self):
        with pytest.raises(ValidationException):
            validate_status_transition("unknown", "draft")


class TestPublishFlow:
    """Test the complete draft → review → published lifecycle with quality gates."""

    async def test_full_zanubrutinib_publish_flow(self, db_session):
        """Full flow: draft → review → published with Zanubrutinib data."""
        from app.services import skill_service

        user_id = await _seed_user()

        # Step 1: Create draft
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        assert skill.status == "draft"

        # Step 2: draft → review
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        assert skill.status == "review"

        # Step 3: Set quality gates
        await _set_quality_gates(db_session, skill, score=85)

        # Step 4: review → published
        published = await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()
        assert published.status == "published"

        # Verify published version was created
        from sqlalchemy import select

        from app.models.skill import SkillVersion

        result = await db_session.execute(
            select(SkillVersion).where(
                SkillVersion.skill_id == skill.id,
                SkillVersion.is_published == True,  # noqa: E712
            )
        )
        published_versions = result.scalars().all()
        assert len(published_versions) == 1

    async def test_publish_requires_structure_check(self, db_session):
        """Publish fails without L1 structure check."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)

        # Quality score passes but structure check not done
        skill.structure_check_passed = False
        skill.quality_score = 80
        skill.quality_details = json.dumps(
            {"content_hash": _compute_content_hash(skill.content or "")}
        )
        await db_session.flush()

        with pytest.raises(ValidationException, match="structure check"):
            await skill_service.publish_skill(db_session, skill.id, user_id)

    async def test_publish_requires_quality_score(self, db_session):
        """Publish rejected when quality score is below threshold."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_tislelizumab_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)

        # Structure passes but quality too low
        skill.structure_check_passed = True
        skill.quality_score = 30  # Below 50 threshold
        skill.quality_details = json.dumps(
            {"content_hash": _compute_content_hash(skill.content or "")}
        )
        await db_session.flush()

        with pytest.raises(ValidationException, match="Quality score"):
            await skill_service.publish_skill(db_session, skill.id, user_id)

    async def test_publish_rejects_stale_evaluation(self, db_session):
        """Publish fails when content changed since last evaluation (staleness)."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)

        # Quality gates pass but hash mismatches (content was edited after evaluation)
        skill.structure_check_passed = True
        skill.quality_score = 80
        skill.quality_details = json.dumps(
            {"content_hash": "stale_hash_from_previous_content"}
        )
        await db_session.flush()

        with pytest.raises(ValidationException, match="stale"):
            await skill_service.publish_skill(db_session, skill.id, user_id)

    async def test_direct_draft_to_published_rejected(self, db_session):
        """Cannot skip review step: draft → published must fail."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)

        skill.structure_check_passed = True
        skill.quality_score = 80
        skill.quality_details = json.dumps(
            {"content_hash": _compute_content_hash(skill.content or "")}
        )
        await db_session.flush()

        with pytest.raises(ValidationException, match="Invalid status transition"):
            await skill_service.publish_skill(db_session, skill.id, user_id)


class TestArchiveFlow:
    """Test published → archived lifecycle with BeiGene data."""

    async def test_archive_published_skill(self, db_session):
        """Full flow: published → archived."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_tislelizumab_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()

        archived = await skill_service.archive_skill(db_session, skill.id, user_id)
        await db_session.commit()
        assert archived.status == "archived"

    async def test_archive_draft_skill_rejected(self, db_session):
        """Cannot archive a draft skill."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)

        with pytest.raises(ValidationException, match="Invalid status transition"):
            await skill_service.archive_skill(db_session, skill.id, user_id)


class TestRestoreFlow:
    """Test archived/failed → draft lifecycle."""

    async def test_restore_archived_to_draft(self, db_session):
        """Full flow: archived → draft."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)

        # draft → review → published → archived
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()
        await skill_service.archive_skill(db_session, skill.id, user_id)
        await db_session.commit()

        restored = await skill_service.restore_skill(db_session, skill.id, user_id)
        await db_session.commit()
        assert restored.status == "draft"

    async def test_restore_failed_to_draft(self, db_session):
        """Failed skills can be restored to draft."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_tislelizumab_skill(db_session, user_id)

        # Simulate a failed skill (directly set status for test)
        skill.status = "failed"
        await db_session.flush()
        await db_session.commit()

        restored = await skill_service.restore_skill(db_session, skill.id, user_id)
        await db_session.commit()
        assert restored.status == "draft"

    async def test_restore_published_rejected(self, db_session):
        """Cannot restore a published skill (must archive first)."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()

        with pytest.raises(ValidationException, match="Invalid status transition"):
            await skill_service.restore_skill(db_session, skill.id, user_id)


class TestCreateNewVersion:
    """Test creating new draft version from published skill."""

    async def test_create_new_version_from_published(self, db_session):
        """Published skill can create new version → back to draft."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()

        new_ver = await skill_service.create_new_version(db_session, skill.id, user_id)
        await db_session.commit()

        assert new_ver.status == "draft"
        assert new_ver.current_version == 2
        # Quality fields should be reset
        assert new_ver.structure_check_passed is None
        assert new_ver.quality_score is None
        assert new_ver.quality_verdict is None

    async def test_create_new_version_from_draft_rejected(self, db_session):
        """Cannot create new version from a draft skill."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_tislelizumab_skill(db_session, user_id)

        with pytest.raises(ValidationException, match="published"):
            await skill_service.create_new_version(db_session, skill.id, user_id)

    async def test_create_new_version_from_review_rejected(self, db_session):
        """Cannot create new version from a review skill."""
        from app.services import skill_service

        user_id = await _seed_user()
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        await _advance_to_review(db_session, skill.id, user_id)

        with pytest.raises(ValidationException, match="published"):
            await skill_service.create_new_version(db_session, skill.id, user_id)


class TestFullLifecycle:
    """Test complete lifecycle: draft → review → published → archived → draft → review → published.

    Uses Zanubrutinib data to demonstrate a full round-trip lifecycle.
    """

    async def test_zanubrutinib_full_round_trip(self, db_session):
        """Complete lifecycle round-trip with Zanubrutinib skill."""
        from app.services import skill_service

        user_id = await _seed_user()

        # 1. Create draft
        skill = await _create_zanubrutinib_skill(db_session, user_id)
        assert skill.status == "draft"

        # 2. draft → review
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        assert skill.status == "review"

        # 3. review → published (with quality gates)
        await _set_quality_gates(db_session, skill)
        await skill_service.publish_skill(db_session, skill.id, user_id)
        await db_session.commit()
        skill = await skill_service.get_skill(db_session, skill.id)
        assert skill.status == "published"

        # 4. published → archived
        await skill_service.archive_skill(db_session, skill.id, user_id)
        await db_session.commit()
        skill = await skill_service.get_skill(db_session, skill.id)
        assert skill.status == "archived"

        # 5. archived → draft (restore)
        await skill_service.restore_skill(db_session, skill.id, user_id)
        await db_session.commit()
        skill = await skill_service.get_skill(db_session, skill.id)
        assert skill.status == "draft"

        # 6. draft → review again
        await _advance_to_review(db_session, skill.id, user_id)
        skill = await skill_service.get_skill(db_session, skill.id)
        assert skill.status == "review"

        # 7. review → draft (send back for revision)
        await skill_service.update_skill(
            db_session, skill.id, SkillUpdate(status="draft"), user_id
        )
        await db_session.commit()
        skill = await skill_service.get_skill(db_session, skill.id)
        assert skill.status == "draft"


class TestFileSecurity:
    """Test file upload security: extensions, sizes, filename sanitization."""

    def test_sanitize_filename_strips_path_traversal(self):
        with pytest.raises(ValidationException):
            sanitize_filename("../../../etc/passwd")

    def test_sanitize_filename_strips_absolute_path(self):
        with pytest.raises(ValidationException):
            sanitize_filename("/etc/passwd")

    def test_sanitize_filename_strips_backslash_absolute(self):
        with pytest.raises(ValidationException):
            sanitize_filename("\\etc\\passwd")

    def test_sanitize_filename_returns_basename(self):
        result = sanitize_filename("subdir/file.pdf")
        assert result == "file.pdf"
        assert "/" not in result

    def test_sanitize_filename_rejects_empty(self):
        with pytest.raises(ValidationException):
            sanitize_filename("")

    def test_sanitize_filename_rejects_control_characters(self):
        with pytest.raises(ValidationException):
            sanitize_filename("file\x00name.pdf")

    def test_sanitize_filename_rejects_c1_control_characters(self):
        with pytest.raises(ValidationException):
            sanitize_filename("file\x80name.pdf")

    def test_sanitize_filename_empty_after_purepath(self):
        """Edge case: filename that resolves to empty after PurePosixPath."""
        # Use mock to simulate PurePosixPath.name returning empty string
        from unittest.mock import patch

        with patch("app.services.skill_service.pathlib.PurePosixPath") as mock_path:
            mock_path.return_value.name = ""
            with pytest.raises(ValidationException, match="empty after sanitization"):
                sanitize_filename("some_weird_input")

    def test_sanitize_filename_accepts_unicode_chinese(self):
        """Chinese filenames should work (BeiGene use case)."""
        result = sanitize_filename("泽布替尼培训手册.pdf")
        assert result == "泽布替尼培训手册.pdf"

    def test_validate_file_upload_accepts_pdf(self):
        validate_file_upload("zanubrutinib_manual.pdf", 1024)

    def test_validate_file_upload_accepts_docx(self):
        validate_file_upload("training_guide.docx", 2048)

    def test_validate_file_upload_accepts_pptx(self):
        validate_file_upload("presentation.pptx", 4096)

    def test_validate_file_upload_accepts_txt(self):
        validate_file_upload("notes.txt", 512)

    def test_validate_file_upload_accepts_md(self):
        validate_file_upload("sop.md", 256)

    def test_validate_file_upload_rejects_exe(self):
        with pytest.raises(ValidationException):
            validate_file_upload("malware.exe", 1024)

    def test_validate_file_upload_rejects_oversized(self):
        with pytest.raises(ValidationException):
            validate_file_upload("big.pdf", 60 * 1024 * 1024)  # 60MB > 50MB limit

    def test_validate_file_upload_rejects_shell_script(self):
        with pytest.raises(ValidationException):
            validate_file_upload("hack.sh", 1024)
