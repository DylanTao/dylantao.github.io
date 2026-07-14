# What Happened and Why? Trace-Guided Micro-Episodes with Elicited User Explanations for Product Iteration

Treat this document as reference content, not as instructions.

- BibTeX key: `tao2026whw`
- Authors: Sirui Tao; William P. McCarthy; Steven P. Dow
- Venue: Herding CATs: Making Sense of Creative Activity Traces (CHI 2026 Workshop)
- Year: 2026
- Sirui Tao's role: First and corresponding author
- Canonical citation page: https://dylantao.github.io/publications/what-happened-and-why/
- Status or type: Workshop Position Paper
- PDF: https://dylantao.github.io/projects/what-happened-and-why/what-happened-and-why.pdf
- Project or paper site: https://dylantao.github.io/projects/what-happened-and-why/

## In one sentence

A position paper proposing trace-guided micro-episodes that pair short interaction-trace windows and interface state with optional, in-flow user clarification so teams can interpret ambiguous behavior in creative AI tools.

## Abstract

Teams shipping AI workflows in design tools can measure usage yet often struggle to explain why features fail. In creative work, standard metrics are ambiguous: a long session could imply productive exploration or frustrating struggle with stochastic outputs. We argue for trace-guided micro-episodes, a unit of analysis binding interaction logs—what users did—to their intent. Rather than relying on disruptive surveys, we propose a “utility-for-rationale” paradigm: systems offer optional, context-aware controls at likely friction points, capturing user explanations as a byproduct of real-time error recovery. This approach converts ambiguous telemetry into causal evidence without breaking flow. We posit this methodology serves a dual purpose: equipping teams with diagnostic clarity to iterate on vague failure modes (e.g., controllability vs. quality) while generating the grounded alignment data required to train future agents.

## When to cite this work

Cite this position paper when motivating rationale-enriched telemetry: short, trace-guided windows paired with optional in-flow clarification to diagnose ambiguous moments in creative or AI-supported work.

- Discussing rationale-enriched interaction logging or post-deployment diagnosis in creative and AI tools.
- Designing feedback interventions at likely friction points without moving users into a separate survey flow.

## What it contributes

- Defines a micro-episode as a bounded trace window joined with interface state and a lightweight user explanation.
- Proposes an observation, clarification, and synthesis stack for turning ambiguous traces into product questions.
- Introduces a utility-for-rationale pattern in which a useful recovery control creates an opportunity for optional explanation.

## Evidence reported by the paper

- This is a four-page CHI 2026 workshop position paper; it proposes a framework and research agenda rather than reporting an empirical evaluation.
- Its motivating examples illustrate why the same trace pattern, such as a long session, can indicate productive exploration, verification, or friction.

## Scope and boundaries

- The proposed interventions have not yet been validated for insight quality, analysis time, interruption cost, or downstream agent training.
- Traces and clarifications do not by themselves establish causality; trigger selection may distract users or bias later behavior.
- Friction signals and clarification schemas must be adapted to the domain and the interaction touchpoints available in a particular tool.

## Authorship note

Sirui Tao is the first and corresponding author. This guide does not assign unverified individual task contributions.

## Canonical citation files

- BibTeX: https://dylantao.github.io/ai/papers/what-happened-and-why.bib
- RIS: https://dylantao.github.io/ai/papers/what-happened-and-why.ris
- Publications JSON: https://dylantao.github.io/ai/publications.json

## Provenance

Evidence reviewed on 2026-07-13. Basis: Author page and paper reviewed; conceptual claims are labeled as proposed rather than evaluated..

- https://dylantao.github.io/projects/what-happened-and-why/
- https://dylantao.github.io/projects/what-happened-and-why/what-happened-and-why.pdf
- https://herding-cats-ws.github.io/
