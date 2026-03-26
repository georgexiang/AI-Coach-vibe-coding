"""Seed training materials for BeiGene products (Zanubrutinib, Tislelizumab).

Creates TrainingMaterial, MaterialVersion, and MaterialChunk records
for RAG retrieval during coaching sessions.

Idempotent -- skips materials that already exist (by name).
Run with: python3 scripts/seed_materials.py
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Add backend root to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.base import Base
from app.models.material import MaterialChunk, MaterialVersion, TrainingMaterial
from app.models.user import User

settings = get_settings()


ZANUBRUTINIB_CHUNKS = [
    {
        "chunk_index": 0,
        "page_label": "Overview",
        "content": (
            "泽布替尼 (Zanubrutinib, 百悦泽®) 产品概述\n\n"
            "泽布替尼是百济神州自主研发的新一代布鲁顿酪氨酸激酶 (BTK) 抑制剂，"
            "专为最大化BTK靶点占有率和最小化脱靶效应而设计。\n\n"
            "获批适应症:\n"
            "• 复发/难治性套细胞淋巴瘤 (MCL)\n"
            "• 慢性淋巴细胞白血病/小淋巴细胞淋巴瘤 (CLL/SLL)\n"
            "• 华氏巨球蛋白血症 (WM)\n"
            "• 边缘区淋巴瘤 (MZL)\n\n"
            "剂型与用法:\n"
            "• 口服胶囊，每次160mg，每日两次\n"
            "• 可与或不与食物同服\n"
            "• 治疗持续至疾病进展或不可耐受的毒性"
        ),
    },
    {
        "chunk_index": 1,
        "page_label": "Mechanism",
        "content": (
            "作用机制 (Mechanism of Action)\n\n"
            "泽布替尼是一种选择性BTK抑制剂，通过与BTK活性位点的Cys481残基形成共价键，"
            "不可逆地抑制BTK活性。\n\n"
            "关键特征:\n"
            "• 高选择性: 对BTK的选择性优于第一代BTK抑制剂伊布替尼\n"
            "• 减少脱靶效应: 对ITK、EGFR、TEC等激酶的抑制作用较低\n"
            "• 更高的BTK靶点占有率: 在推荐剂量下可达到>95%的BTK占有率\n"
            "• 优化的药代动力学: 口服生物利用度高，半衰期约4-6小时\n\n"
            "BTK在B细胞受体(BCR)信号通路中起关键作用，抑制BTK可阻断B细胞增殖、"
            "迁移和存活信号，从而发挥抗肿瘤作用。"
        ),
    },
    {
        "chunk_index": 2,
        "page_label": "ALPINE Trial",
        "content": (
            "ALPINE研究 — 头对头比较泽布替尼 vs 伊布替尼\n\n"
            "研究设计:\n"
            "• III期、随机、开放标签研究\n"
            "• 入组: 652例复发/难治性CLL/SLL患者\n"
            "• 随机分配: 泽布替尼 160mg BID vs 伊布替尼 420mg QD\n\n"
            "主要疗效结果:\n"
            "• 总缓解率(ORR): 泽布替尼 78.3% vs 伊布替尼 62.5% (p<0.001)\n"
            "• 12个月PFS率: 泽布替尼 94.9% vs 伊布替尼 84.0%\n"
            "• 中位随访28.1个月，PFS优势显著 (HR=0.65, 95%CI 0.49-0.86)\n\n"
            "安全性优势:\n"
            "• 房颤/房扑: 泽布替尼 2.5% vs 伊布替尼 10.1%\n"
            "• 任何级别出血: 泽布替尼 45.4% vs 伊布替尼 51.9%\n"
            "• 高血压: 泽布替尼 14.8% vs 伊布替尼 11.1%\n"
            "• 因不良事件停药: 泽布替尼 15.4% vs 伊布替尼 22.2%"
        ),
    },
    {
        "chunk_index": 3,
        "page_label": "SEQUOIA Trial",
        "content": (
            "SEQUOIA研究 — 一线CLL/SLL治疗\n\n"
            "研究设计:\n"
            "• III期、随机研究\n"
            "• 入组: 初治CLL/SLL患者（无del(17p)）\n"
            "• 对照: 苯达莫司汀+利妥昔单抗 (BR)\n\n"
            "关键结果:\n"
            "• 24个月PFS率: 泽布替尼 85.5% vs BR 69.5%\n"
            "• ORR: 泽布替尼 94.6% vs BR 85.3%\n"
            "• PFS HR=0.42 (95%CI 0.28-0.63, p<0.001)\n\n"
            "临床意义:\n"
            "泽布替尼单药在初治CLL/SLL患者中显著优于标准化疗免疫方案，"
            "支持其作为一线治疗选择。"
        ),
    },
    {
        "chunk_index": 4,
        "page_label": "Safety",
        "content": (
            "安全性概述\n\n"
            "常见不良反应 (≥20%):\n"
            "• 中性粒细胞减少: 27%\n"
            "• 上呼吸道感染: 24%\n"
            "• 血小板减少: 22%\n"
            "• 腹泻: 21%\n\n"
            "需要关注的不良反应:\n"
            "• 出血: 总体发生率45%，≥3级 4.3%\n"
            "• 感染: ≥3级感染 22%\n"
            "• 心房颤动/心房扑动: 2.5%\n"
            "• 二次恶性肿瘤: 包括非黑色素瘤皮肤癌\n\n"
            "特殊人群:\n"
            "• 肝功能不全: 中度/重度肝功能损害患者需减量至80mg BID\n"
            "• 与CYP3A强抑制剂合用时需减量至80mg QD\n"
            "• 避免与CYP3A强诱导剂合用"
        ),
    },
    {
        "chunk_index": 5,
        "page_label": "Competitive",
        "content": (
            "竞品比较 — BTK抑制剂\n\n"
            "泽布替尼 vs 伊布替尼 (Ibrutinib):\n"
            "• 选择性更高，脱靶效应更少\n"
            "• 心脏安全性更优 (房颤率2.5% vs 10.1%)\n"
            "• 更高的ORR (78.3% vs 62.5%)\n"
            "• 更好的PFS (HR=0.65)\n\n"
            "泽布替尼 vs 阿卡替尼 (Acalabrutinib):\n"
            "• 两者均为高选择性BTK抑制剂\n"
            "• 泽布替尼的头对头数据更充分 (ALPINE研究)\n"
            "• 泽布替尼的全球注册数据覆盖超过5000名患者\n\n"
            "关键差异化优势:\n"
            "1. ALPINE是唯一证实BTKi头对头优效性的III期研究\n"
            "2. 心脏安全性 — 房颤率最低\n"
            "3. 获批适应症最广 — MCL、CLL/SLL、WM、MZL"
        ),
    },
]

TISLELIZUMAB_CHUNKS = [
    {
        "chunk_index": 0,
        "page_label": "Overview",
        "content": (
            "替雷利珠单抗 (Tislelizumab, 百泽安®) 产品概述\n\n"
            "替雷利珠单抗是百济神州研发的抗PD-1单克隆抗体，"
            "经过独特的Fc段工程优化设计，减少与巨噬细胞FcγR结合，"
            "降低抗体依赖的细胞吞噬效应(ADCP)导致的T细胞消耗。\n\n"
            "获批适应症:\n"
            "• 经典型霍奇金淋巴瘤 (cHL)\n"
            "• 尿路上皮癌 (UC)\n"
            "• 非小细胞肺癌 (NSCLC)\n"
            "• 肝细胞癌 (HCC)\n"
            "• 食管鳞状细胞癌 (ESCC)\n"
            "• 鼻咽癌 (NPC)\n\n"
            "剂型与用法:\n"
            "• 静脉注射，200mg，每3周一次\n"
            "• 治疗直至疾病进展或不可耐受毒性"
        ),
    },
    {
        "chunk_index": 1,
        "page_label": "Mechanism",
        "content": (
            "作用机制 (Mechanism of Action)\n\n"
            "替雷利珠单抗通过与T细胞表面的PD-1受体结合，阻断PD-1与其配体"
            "(PD-L1和PD-L2)的相互作用，从而解除肿瘤微环境中T细胞的免疫抑制，"
            "恢复T细胞的抗肿瘤免疫功能。\n\n"
            "独特设计:\n"
            "• Fc段经过工程化修饰，减少与巨噬细胞FcγR的结合\n"
            "• 降低了抗体依赖的细胞吞噬效应(ADCP)的风险\n"
            "• 减少巨噬细胞介导的T细胞消耗\n"
            "• 理论上可更好地保护活化的T细胞\n\n"
            "PD-1信号通路:\n"
            "肿瘤细胞通过高表达PD-L1与T细胞上的PD-1结合，抑制T细胞活性。"
            "替雷利珠单抗阻断这一通路，恢复T细胞对肿瘤的杀伤能力。"
        ),
    },
    {
        "chunk_index": 2,
        "page_label": "RATIONALE-301",
        "content": (
            "RATIONALE-301研究 — 食管鳞癌二线治疗\n\n"
            "研究设计:\n"
            "• III期、随机、开放标签研究\n"
            "• 入组: 512例经治的晚期/转移性食管鳞状细胞癌患者\n"
            "• 对照: 研究者选择的化疗\n\n"
            "主要结果:\n"
            "• 中位OS: 替雷利珠单抗 8.6个月 vs 化疗 6.3个月 (HR=0.70)\n"
            "• PD-L1 TAP≥10%亚组: 替雷利珠单抗 17.2个月 vs 化疗 10.6个月\n"
            "• ORR: 替雷利珠单抗 20.3% vs 化疗 9.8%\n"
            "• 缓解持续时间(DOR): 替雷利珠单抗 7.1个月 vs 化疗 4.0个月\n\n"
            "临床意义:\n"
            "替雷利珠单抗在经治ESCC患者中展现了显著的OS获益，"
            "特别是在PD-L1高表达患者中。"
        ),
    },
    {
        "chunk_index": 3,
        "page_label": "RATIONALE-302/303",
        "content": (
            "RATIONALE-302/303研究 — NSCLC\n\n"
            "RATIONALE-302 (二线NSCLC):\n"
            "• 入组: 805例经治晚期NSCLC\n"
            "• 主要终点: OS非劣效性达到 (HR=0.75, 95%CI 0.61-0.91)\n"
            "• 替雷利珠单抗 vs 多西他赛，中位OS显著改善\n\n"
            "RATIONALE-303/304 (一线NSCLC联合化疗):\n"
            "• 替雷利珠单抗联合含铂化疗 vs 单纯化疗\n"
            "• 鳞状NSCLC: 中位PFS 7.6个月 vs 5.5个月 (HR=0.52)\n"
            "• 非鳞状NSCLC: 中位PFS 9.7个月 vs 7.6个月 (HR=0.65)\n"
            "• ORR: 联合方案 57.4% vs 化疗 36.9%\n\n"
            "关键信息:\n"
            "替雷利珠单抗无论单药还是联合化疗，在NSCLC各亚型中均展现了有意义的临床获益。"
        ),
    },
    {
        "chunk_index": 4,
        "page_label": "Safety",
        "content": (
            "安全性概述\n\n"
            "常见不良反应 (≥10%):\n"
            "• 贫血: 17%\n"
            "• 咳嗽: 15%\n"
            "• 疲劳: 14%\n"
            "• 食欲下降: 12%\n"
            "• 甲状腺功能减退: 12%\n"
            "• 皮疹: 11%\n\n"
            "免疫相关不良反应 (irAEs):\n"
            "• 甲状腺功能异常: 最常见irAE\n"
            "• 肺炎: 3.3% (≥3级: 1.1%)\n"
            "• 心肌炎: <1% (需密切监测)\n"
            "• 肝炎: 2.8% (≥3级: 1.2%)\n"
            "• 肾炎: <1%\n\n"
            "心脏安全性关注:\n"
            "• 心肌炎发生率低于1%，大多数为1-2级\n"
            "• 建议治疗前进行基线心脏评估 (ECG + 肌钙蛋白)\n"
            "• 每个治疗周期监测心脏生物标志物\n"
            "• 出现症状时立即暂停治疗并进行心脏评估"
        ),
    },
    {
        "chunk_index": 5,
        "page_label": "Competitive",
        "content": (
            "竞品比较 — 抗PD-1/PD-L1抗体\n\n"
            "替雷利珠单抗 vs 帕博利珠单抗 (Pembrolizumab):\n"
            "• 独特的Fc段设计减少T细胞消耗\n"
            "• ESCC适应症竞争优势明显\n"
            "• 价格竞争力更强 (尤其在中国市场)\n\n"
            "替雷利珠单抗 vs 纳武利尤单抗 (Nivolumab):\n"
            "• 给药频率: 每3周 vs 每2周\n"
            "• 患者依从性可能更好\n"
            "• 在亚洲人群中的临床数据更丰富\n\n"
            "关键差异化优势:\n"
            "1. Fc段工程化设计 — 理论上更好保护T细胞\n"
            "2. 中国最大规模的PD-1临床研究项目之一\n"
            "3. 在消化道肿瘤中的数据积累领先\n"
            "4. 从单药到联合治疗的全面布局"
        ),
    },
]


SEED_MATERIALS = [
    {
        "name": "Zanubrutinib (泽布替尼) Product Training Manual",
        "product": "Zanubrutinib",
        "therapeutic_area": "Oncology / Hematology",
        "tags": "BTK,CLL,MCL,WM,MZL,ALPINE,SEQUOIA",
        "filename": "zanubrutinib_training_manual_v1.pdf",
        "content_type": "application/pdf",
        "file_size": 2_048_000,
        "chunks": ZANUBRUTINIB_CHUNKS,
    },
    {
        "name": "Tislelizumab (替雷利珠单抗) Product Training Manual",
        "product": "Tislelizumab",
        "therapeutic_area": "Oncology / Immunotherapy",
        "tags": "PD-1,NSCLC,ESCC,HCC,cHL,RATIONALE",
        "filename": "tislelizumab_training_manual_v1.pdf",
        "content_type": "application/pdf",
        "file_size": 1_856_000,
        "chunks": TISLELIZUMAB_CHUNKS,
    },
]


async def seed_materials() -> None:
    """Create seed training materials with versions and chunks."""
    engine = create_async_engine(settings.database_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Get admin user for created_by
        result = await session.execute(select(User).where(User.role == "admin"))
        admin = result.scalar_one_or_none()
        if admin is None:
            print("  [error] No admin user found. Run seed_data.py first.")
            await engine.dispose()
            return

        admin_id = admin.id

        print("Seeding training materials...")
        for mat_data in SEED_MATERIALS:
            name = mat_data["name"]
            result = await session.execute(
                select(TrainingMaterial).where(TrainingMaterial.name == name)
            )
            if result.scalar_one_or_none() is not None:
                print(f"  [skip] Material '{name}' already exists")
                continue

            # Create TrainingMaterial
            material_id = str(uuid.uuid4())
            material = TrainingMaterial(
                id=material_id,
                name=name,
                product=mat_data["product"],
                therapeutic_area=mat_data["therapeutic_area"],
                tags=mat_data["tags"],
                is_archived=False,
                current_version=1,
                created_by=admin_id,
            )
            session.add(material)

            # Create MaterialVersion
            version_id = str(uuid.uuid4())
            storage_url = f"materials/{material_id}/v1/{mat_data['filename']}"
            version = MaterialVersion(
                id=version_id,
                material_id=material_id,
                version_number=1,
                filename=mat_data["filename"],
                file_size=mat_data["file_size"],
                content_type=mat_data["content_type"],
                storage_url=storage_url,
                is_active=True,
            )
            session.add(version)

            # Create MaterialChunks
            for chunk_data in mat_data["chunks"]:
                chunk = MaterialChunk(
                    id=str(uuid.uuid4()),
                    version_id=version_id,
                    material_id=material_id,
                    chunk_index=chunk_data["chunk_index"],
                    content=chunk_data["content"],
                    page_label=chunk_data["page_label"],
                )
                session.add(chunk)

            print(
                f"  [created] Material '{name}' "
                f"({mat_data['product']}, {len(mat_data['chunks'])} chunks)"
            )

        await session.commit()

    await engine.dispose()
    print("Materials seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_materials())
