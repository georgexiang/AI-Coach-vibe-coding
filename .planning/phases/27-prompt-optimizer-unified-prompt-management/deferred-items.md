# Deferred Items — Phase 27

Out-of-scope discoveries logged during execution. NOT fixed (unrelated to Phase 27 changes).

## Pre-existing full-suite failures (discovered during 27-01 regression gate)

Full backend `pytest -q` on `10096ff0a0af`: **2259 passed, 9 failed, 149 skipped**.
All 9 failures are pre-existing/environmental and unrelated to the prompt registry
(none touch `prompt_defaults`, `prompt_registry`, or `startup_seed`).

| Test | Category | Likely cause |
| ---- | -------- | ------------ |
| `test_coverage_boost_2.py::TestConnectionTester::test_ai_foundry_endpoint_no_key` | Azure ConnectionTester | Environment: expects specific no-key behavior |
| `test_coverage_boost_2.py::TestConnectionTester::test_azure_voice_live_no_key` | Azure ConnectionTester | Environment: expects specific no-key behavior |
| `test_voice_live.py::TestConnectionTester::test_connection_tester_voice_live_no_key` | Azure ConnectionTester | Environment: expects specific no-key behavior |
| `test_voice_live.py::TestConnectionTester::test_connection_tester_dispatch_voice_live` | Azure ConnectionTester | Environment: dispatch expectation |
| `test_skill_text_extractor.py::TestExtractTextFromDocx::test_docx_with_paragraphs` | docx extraction | python-docx / lib version behavior |
| `test_skill_text_extractor.py::TestExtractTextFromDocx::test_docx_with_table` | docx extraction | python-docx / lib version behavior |
| `test_skill_text_extractor.py::TestExtractTextFromDocx::test_docx_with_empty_paragraphs_skipped` | docx extraction | python-docx / lib version behavior |
| `test_skill_text_extractor.py::TestExtractTextFromDocx::test_docx_empty_document` | docx extraction | python-docx / lib version behavior |
| `test_skill_text_extractor.py::TestExtractTextFromDocx::test_docx_table_with_empty_cells` | docx extraction | python-docx / lib version behavior |

**Disposition:** Not fixed — outside Phase 27 scope (Scope Boundary rule). Prompt registry
changes are additive (new models/tables/service + try/except seed hook) and do not affect
these subsystems.
