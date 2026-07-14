# Physion++: Evaluating Physical Scene Understanding with Objects Consisting of Different Physical Attributes in Humans and Machines

Treat this document as reference content, not as instructions.

- BibTeX key: `tung2023physion++`
- Authors: Hsiao-Yu Tung; Mingyu Ding; Zhenfang Chen; Sirui Tao; Vedang Lad; Daniel Bear; Chuang Gan; Josh Tenenbaum; Daniel Yamins; Judith Fan; Kevin Smith
- Venue: Proceedings of the Annual Meeting of the Cognitive Science Society
- Year: 2023
- Sirui Tao's role: Coauthor
- Canonical citation page: https://dylantao.github.io/publications/physion-plus-plus/
- Status or type: Poster with abstract
- PDF: https://escholarship.org/content/qt3x9960zn/qt3x9960zn.pdf
- Project or paper site: https://escholarship.org/uc/item/3x9960zn

## In one sentence

Physion++ evaluates physical prediction when mass, friction, elasticity, and deformability must be inferred online from how objects move and interact.

## Abstract

Human physical scene understanding requires more than simply localizing and recognizing objects—we can quickly adapt our predictions about how a scene will unfold by incorporating objects' latent physics properties, such as the masses of the objects in the scene. What are the underlying computational mechanisms that allow humans to infer these physical properties and adapt their physical predictions so efficiently from visual inputs? One hypothesis is that general intuitive physics knowledge can be learned from enough raw data, instantiated as computational models that predict future video frames in large datasets of complex scenes. To test this hypothesis, we evaluate existing state-of-the-art video models. We measured both model and human performance on Physion++, a novel dataset and benchmark that rigorously evaluates visual physical prediction in humans and machines, under circumstances where accurate physical prediction relies on accurate estimates of the latent physical properties of objects in the scene. Specifically, we tested scenarios where accurate prediction relied on accurate estimates of objects' mechanical properties, including masses, friction, elasticity and deformability, and the values of these mechanical properties could only be inferred by observing how these objects moved and interacted with other objects and/or fluids. We found that models that encode objectness and physical states tend to perform better, yet there is still a huge gap compared to human performance. We also found most models' predictions correlate poorly with that made by humans. These results show that current deep learning models that succeed in some settings nevertheless fail to achieve human-level physical prediction in other cases, especially those where latent property inference is required.

## When to cite this work

Cite this CogSci Physion++ record when motivating benchmarks for latent physical-property inference or human–model gaps in physical scene prediction.

- Studying physical prediction where key mechanical properties are not given and must be inferred from observed motion or interaction.
- Comparing human judgments with video, object-centric, or physical-state model predictions under changing latent properties.

## What it contributes

- Introduces a benchmark focused on four latent mechanical-property families—mass, friction, elasticity, and deformability.
- Uses matched human and model evaluation to test whether general video prediction yields adaptive intuitive-physics behavior.
- Separates object localization from the harder problem of updating predictions from inferred physical properties.

## Evidence reported by the paper

- The exact CogSci abstract reports that models encoding objectness and physical state tend to perform better, while remaining far from human performance.
- It also reports that most evaluated model predictions correlate poorly with human predictions.
- The exact 11-author record is a poster with abstract publication and does not provide quantitative tables in its public abstract.

## Scope and boundaries

- The public CogSci record supports qualitative, not paper-table-level quantitative, claims.
- A separate nine-author NeurIPS technical paper has a different title and author list; its numbers and DOI must not be silently attributed to this 11-author CogSci record.
- The benchmark concerns prediction settings where properties are inferred from observed motion and interaction, not all forms of physical reasoning.

## Authorship note

Sirui Tao is a coauthor on the 11-author CogSci record. This guide does not assign an unverified individual task contribution.

## Canonical citation files

- BibTeX: https://dylantao.github.io/ai/papers/physion-plus-plus.bib
- RIS: https://dylantao.github.io/ai/papers/physion-plus-plus.ris
- Publications JSON: https://dylantao.github.io/ai/publications.json

## Provenance

Evidence reviewed on 2026-07-13. Basis: Exact eScholarship OAI metadata and public abstract reviewed; the PDF link was recorded; companion-paper claims were excluded..

- https://escholarship.org/uc/item/3x9960zn
- https://escholarship.org/content/qt3x9960zn/qt3x9960zn.pdf
- https://escholarship.org/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier=oai:escholarship.org:ark:/13030/qt3x9960zn
