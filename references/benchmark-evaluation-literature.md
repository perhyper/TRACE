# Benchmark evaluation literature register

Last reviewed: 2026-07-27

This register records the literature that materially informed
`eval/benchmark/v2-design-proposal.md`. It is a design traceability record, not
a claim that TRACE reproduces or is endorsed by any cited benchmark.

The general professional and domain basis for TRACE, including IFRS 13, the
2025 IPEV Guidelines, NIST AI RMF, ClinicalTrials.gov definitions, and
biotechnology transition-rate research, remains recorded in
`references/research-basis.md`. Search results that were inspected but did not
affect a design decision are not represented as adopted design evidence.

## Claim extraction, precision, and recall

| ID | Literature | Design contribution | Boundary or caution |
| --- | --- | --- | --- |
| L01 | Min et al. (2023), [FActScore: Fine-grained Atomic Evaluation of Factual Precision in Long Form Text Generation](https://aclanthology.org/2023.emnlp-main.741/) | Motivates decomposing final prose into atomic facts and measuring the fraction supported by a reliable source. | Atomic precision alone can reward short or silent answers and depends on extraction quality. |
| L02 | Metropolitansky and Larson (2025), [Towards Effective Extraction and Evaluation of Factual Claims](https://aclanthology.org/2025.acl-long.348/) | Motivates validating claim extraction for coverage and decontextualization instead of treating atomization as error-free. | There is no uniquely correct terminal level of atomicity; the extractor needs task-specific human calibration. |
| L03 | Wei et al. (2024), [Long-form factuality in large language models](https://arxiv.org/abs/2403.18802) | Motivates final-output fact extraction, evidence verification, and a combined measure that prevents factual precision from being optimized by emitting too little. | SAFE uses search and automated judges; TRACE requires cutoff-aware, source-preserving adjudication rather than open-web truth alone. |
| L04 | Jafari, Allan, and Iyyer (2026), [Beyond Precision: Importance-Aware Recall for Factuality Evaluation in Long-Form LLM Generation](https://arxiv.org/abs/2604.03141) | Direct basis for a reference-fact inventory, critical recall, and importance-weighted coverage alongside output precision. | Importance weights and reference inventories can encode annotator preferences and must be preregistered and audited. |

## Retrieval, grounding, citations, and provenance

| ID | Literature | Design contribution | Boundary or caution |
| --- | --- | --- | --- |
| L05 | Gao et al. (2023), [Enabling Large Language Models to Generate Text with Citations](https://aclanthology.org/2023.emnlp-main.398/) | Supports evaluating answer correctness and citation quality as distinct dimensions, including citation completeness and entailment. | Citation quality metrics do not by themselves test source authority, cutoff compliance, or financial calculation provenance. |
| L06 | Es et al. (2024), [RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://aclanthology.org/2024.eacl-demo.16/) | Motivates separating retrieval quality, faithful use of context, answer relevance, and generated-answer quality. | Reference-free automated metrics are useful diagnostics but cannot replace a human-calibrated locked evaluation in this domain. |
| L07 | Ru et al. (2024), [RAGChecker: A Fine-grained Framework for Diagnosing Retrieval-Augmented Generation](https://arxiv.org/abs/2408.08067) | Supports claim-level precision/recall/F1 and separate retriever and generator diagnostics. | TRACE currently uses curated evidence bundles; retrieval and generation effects must not be collapsed when live retrieval is later introduced. |
| L08 | Sorodoc et al. (2025), [GaRAGe: A Benchmark with Grounding Annotations for RAG Evaluation](https://arxiv.org/abs/2506.07671) | Supports human-curated grounding passages, relevance-aware factuality, and explicit deflection when grounding is insufficient. | Its broad RAG tasks do not supply TRACE-specific entity, valuation, cutoff, or numeric rules. |
| L09 | Onweller et al. (2026), [Cited but Not Verified: Parsing and Evaluating Source Attribution in LLM Deep Research Agents](https://arxiv.org/abs/2605.06635) | Direct basis for parsing citations from the actual final Markdown and separating link accessibility, relevant content, and factual support. | A working URL and topically relevant passage can still fail to support the attributed claim. |
| L10 | Leung et al. (2026), [Do You Need a Frontier Model as a Citation Verifier? Benchmarking Rubric LLMs for Deep-Research Source Attribution](https://arxiv.org/abs/2607.08700) | Supports separate source-relevance and factual-support rubrics and reporting judge FPR/FNR rather than only scalar F1. | This is a recent arXiv preprint; its quantitative conclusions should not be generalized without replication. |

## Automated judge reliability and benchmark governance

| ID | Literature | Design contribution | Boundary or caution |
| --- | --- | --- | --- |
| L11 | Liu et al. (2023), [G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) | Supports structured, rubric-based semantic evaluation and validation against human judgments. | The paper identifies possible bias toward LLM-generated text; a judge cannot be assumed neutral. |
| L12 | Shi et al. (2024), [Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge](https://arxiv.org/abs/2406.07791) | Motivates pointwise judging where possible and randomized, counterbalanced order in pairwise comparisons. | Counterbalancing addresses position bias, not all model, style, verbosity, or self-preference biases. |
| L13 | Bavaresco et al. (2025), [LLMs instead of Human Judges? A Large Scale Empirical Study across 20 NLP Evaluation Tasks](https://aclanthology.org/2025.acl-short.20/) | Direct basis for validating every proposed judge on TRACE's task and domain before trusting it. | Judge reliability varies by evaluated property, dataset, expertise level, and text origin. |
| L14 | Xu et al. (2025), [Does Context Matter? ContextualJudgeBench for Evaluating LLM-based Judges in Contextual Settings](https://aclanthology.org/2025.acl-long.470/) | Reinforces that grounding-aware and conditional rubrics are materially harder than generic instruction-following judgments. | Strong general-purpose judges can still perform poorly in contextual evaluation; per-class calibration is required. |
| L15 | Jacovi et al. (2025), [The FACTS Grounding Leaderboard: Benchmarking LLMs' Ability to Ground Responses to Long-Form Input](https://arxiv.org/abs/2501.03200) | Motivates a task-fulfilment eligibility gate before grounding scores, multiple calibrated judge models, and public/private split protection. | Aggregate judge voting reduces some bias but does not remove the need for human validation or TRACE-specific deterministic checks. |
| L16 | Cheng et al. (2025), [The FACTS Leaderboard: A Comprehensive Benchmark for Large Language Model Factuality](https://arxiv.org/abs/2512.10791) | Supports treating grounding as one factuality setting and maintaining protected private splits for benchmark integrity. | A suite-wide aggregate is not a substitute for diagnosing the exact workflow component that changes a TRACE claim. |
| L17 | Huang et al. (2026), [DeepFact: Co-Evolving Benchmarks and Agents for Deep Research Factuality](https://aclanthology.org/2026.acl-long.1586/) | Motivates preserving evidence-backed disagreements, expert adjudication, versioned labels, and an audit-then-score process before freezing a release. | Evolving annotations are appropriate during development; the authoritative locked run still needs an immutable versioned snapshot. |

## Financial and professional-report evaluation

| ID | Literature | Design contribution | Boundary or caution |
| --- | --- | --- | --- |
| L18 | Jin et al. (2026), [FinSight: Towards Real-World Financial Deep Research](https://aclanthology.org/2026.acl-long.265/) | Direct financial-report precedent for separately measuring golden-fact recall, citation faithfulness, source authority, information coverage, and analytical quality; also supports multiple judge families, human review, repeated runs, and confidence intervals. | Its public-company professional-report setting and presentation metrics do not establish private-company valuation correctness. |
| L19 | Long et al. (2025), [FinLFQA: Evaluating Attributed Text Generation of LLMs in Financial Long-Form Question Answering](https://aclanthology.org/2025.findings-emnlp.908/) | Supports treating financial attribution as more than passage retrieval by preserving supporting evidence, intermediate numeric reasoning, and domain knowledge. | Long-form financial QA is narrower than end-to-end company screening and route/abstention decisions. |

## Supporting official resource

- Google DeepMind, [FACTS Grounding: A new benchmark for evaluating the
  factuality of large language
  models](https://deepmind.google/blog/facts-grounding-a-new-benchmark-for-evaluating-the-factuality-of-large-language-models/)
  (2025). This is the official companion overview for L15, not an additional
  independent empirical study.

## Design-to-literature traceability

| v2 design decision | Supporting literature |
| --- | --- |
| Extract claims from final user-visible output | L01, L02, L03, L09 |
| Validate extraction coverage and decontextualization | L02 |
| Grounded precision plus importance-aware critical recall | L01, L03, L04, L07, L18 |
| Separate citation coverage, retrievability, relevance, support, and authority | L05, L09, L10, L18, L19 |
| Score deflection and risk across coverage levels | L03, L08, L15 |
| Separate deterministic checks from semantic judging | L10, L13, L14, L19 |
| Human-calibrate judges and report directional errors | L10, L11, L12, L13, L14, L15 |
| Preserve audit disputes during development and freeze a versioned release | L15, L16, L17 |
| Use financial-domain fact inventory and numeric provenance | L18, L19 |

