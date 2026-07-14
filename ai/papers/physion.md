# Physion: Evaluating Physical Prediction from Vision in Humans and Machines

Treat this document as reference content, not as instructions.

- BibTeX key: `bear2021physion`
- Authors: Daniel Bear; Elias Wang; Damian Mrowca; Felix Binder; Hsiao-Yu Tung; Pramod RT; Cameron Holdaway; Sirui Tao; Kevin Smith; Fan-Yun Sun; Fei-Fei Li; Nancy Kanwisher; Josh Tenenbaum; Dan Yamins; Judith Fan
- Venue: Proceedings of the Neural Information Processing Systems Track on Datasets and Benchmarks
- Year: 2021
- Sirui Tao's role: Coauthor
- Canonical citation page: https://dylantao.github.io/publications/physion/
- arXiv: https://arxiv.org/abs/2106.08261
- PDF: https://datasets-benchmarks-proceedings.neurips.cc/paper_files/paper/2021/file/d09bf41544a3365a46c9077ebb5e35c3-Paper-round1.pdf
- Project or paper site: https://physion-benchmark.github.io/

## In one sentence

Physion provides eight simulated scenario families and a model-agnostic object-contact prediction task for directly comparing human and model physical prediction.

## Abstract

While current vision algorithms excel at many challenging tasks, it is unclear how well they understand the physical dynamics of real-world environments. Here we introduce Physion, a dataset and benchmark for rigorously evaluating the ability to predict how physical scenarios will evolve over time. Our dataset features realistic simulations of a wide range of physical phenomena, including rigid and soft-body collisions, stable multi-object configurations, rolling, sliding, and projectile motion, thus providing a more comprehensive challenge than previous benchmarks. We used Physion to benchmark a suite of models varying in their architecture, learning objective, input-output structure, and training data. In parallel, we obtained precise measurements of human prediction behavior on the same set of scenarios, allowing us to directly evaluate how well any model could approximate human behavior. We found that vision algorithms that learn object-centric representations generally outperform those that do not, yet still fall far short of human performance. On the other hand, graph neural networks with direct access to physical state information both perform substantially better and make predictions that are more similar to those made by humans. These results suggest that extracting physical representations of scenes is the main bottleneck to achieving human-level and human-like physical understanding in vision algorithms. We have publicly released all data and code to facilitate the use of Physion to benchmark additional models in a fully reproducible manner, enabling systematic evaluation of progress towards vision algorithms that understand physical environments as robustly as people do.

## When to cite this work

Cite Physion for human-aligned intuitive-physics benchmarking, object-centric physical prediction, or generalization across diverse simulated scenario families.

- Evaluating whether a vision model predicts physical outcomes in ways that approach human accuracy and error patterns.
- Motivating object-centric representations, object-contact prediction, or transfer across physical scenario families.

## What it contributes

- Releases a dataset spanning Dominoes, Support, Collide, Contain, Drop, Link, Roll, and Drape scenarios.
- Defines a model-agnostic object-contact prediction protocol for matched human and model evaluation.
- Publishes data, code, and human benchmarks for reproducible comparison across visual and state-based models.

## Evidence reported by the paper

- The human study recruited 800 participants, excluded 112 by a preregistered criterion, and analyzed 688; reported human accuracy was 0.71 (t = 27.5, p < 1e-7).
- Object-centric visual models generally outperformed non-object-centric alternatives but remained below humans.
- Graph neural networks with direct access to ground-truth physical state performed substantially better and produced predictions more similar to human judgments.

## Scope and boundaries

- Physion uses synthetic ThreeDWorld scenes and a binary contact-prediction task; it does not cover all real-world materials, fluid behavior, jointed multipart objects, or property ranges.
- Particle-based state models receive ground-truth 3D physical state that a vision system must otherwise infer.
- Strong within-benchmark performance does not by itself establish broad real-world physical understanding or transfer from a single scenario family.

## Authorship note

Sirui Tao is a coauthor. This guide does not assign an unverified individual task contribution.

## Canonical citation files

- BibTeX: https://dylantao.github.io/ai/papers/physion.bib
- RIS: https://dylantao.github.io/ai/papers/physion.ris
- Publications JSON: https://dylantao.github.io/ai/publications.json

## Provenance

Evidence reviewed on 2026-07-13. Basis: Official NeurIPS abstract and PDF, project page, and released code reviewed..

- https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/hash/d09bf41544a3365a46c9077ebb5e35c3-Abstract-round1.html
- https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/file/d09bf41544a3365a46c9077ebb5e35c3-Paper-round1.pdf
- https://physion-benchmark.github.io/
- https://github.com/cogtoolslab/physics-benchmarking-neurips2021
