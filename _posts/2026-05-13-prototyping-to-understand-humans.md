---
layout: post
title: prototyping to understand humans
date: 2026-05-13 09:00:00
description: Some working thoughts on good HCI research in the age of AI.
tags: hci research gen-ai prototyping design
categories: reflections
related_posts: false
blog_nav_pool: personal
blog_nav_track: research
blog_nav_stage: 3
blog_nav_next:
  - /blog/2026/science-communication-is-kindness/
  - /blog/2026/specialists-generalists-ai-distributed-cognition/
  - /blog/2026/technical-papers-i-want-to-remember/
permalink: /blog/2026/prototyping-to-understand-humans/
toc:
  beginning: true
---

_Some working thoughts on good HCI research in the age of AI._

I have been thinking about what counts as good HCI research, especially now
that AI makes system-building much easier.

This is not a theory of all research. It is a working note for myself. I am
writing it because I have been confused about the difference between a useful
product idea, a publishable HCI artifact, and a research contribution that still
matters after the prototype is gone.

## The confusion

A lot of HCI artifact and system work can look like this:

1. Find a real user need.
2. Build a tool.
3. Compare it against a baseline.
4. Show that users do better or like it more.
5. Claim a contribution.

This can be valuable. But it can also feel unsatisfying.

If the main claim is only "we built a better tool," then a startup or big
company might be able to do something similar faster. Product teams can
identify user needs, prototype features, run beta tests, dogfood internally,
A/B test, and iterate with many more users than most academic projects can.

So the question that bothers me is:

> If industry can also follow a research-like workflow, what makes academic HCI
> research worth doing?

I do not think the answer is "companies only use knowledge and researchers
produce knowledge." Companies can produce knowledge too. Some product teams run
careful experiments. Some industry researchers do excellent public research.

But I do think the default incentives are different.

A company often wants knowledge as an input:

> Should we ship this? Does this improve our metric? Does this help our product?

Research, at least at its best, tries to produce knowledge as an output:

> What can other people reuse, question, test, adapt, or build on?

That distinction is not absolute. It is more like a useful starting lens.

## What the contribution is

One paper that helped me here is [Jacob O. Wobbrock](https://faculty.washington.edu/wobbrock/)
and [Julie A. Kientz](https://www.hcde.washington.edu/kientz)'s
[_Research Contributions in Human-Computer Interaction_](https://dl.acm.org/doi/10.1145/2907069).

The paper helped because it makes a simple but important point: HCI research
produces different kinds of knowledge. Not every paper should be judged as if
it were the same kind of paper.

Wobbrock and Kientz describe several contribution types in HCI, including
empirical, artifact/system, methodological, theoretical, dataset, survey, and
opinion or argument contributions. This is useful because a system paper is not
automatically weak because it is not a polished product, and an artifact paper
does not always need the same kind of user study as an empirical paper.

But the reverse is also true: a prototype is not automatically research just
because it exists.

The question I want to keep asking is:

> What kind of knowledge does this work produce?

Product knowledge can be local:

> Version B works better for this product, this user base, this metric, and this
> moment.

Research knowledge should be more portable:

> This kind of interaction mechanism helps this kind of human activity under
> these conditions, while creating these trade-offs.

For HCI, "portable" does not have to mean universal. It might mean a reusable
interaction pattern, a clearer account of a human process, a new way to
evaluate a class of systems, a boundary condition, a design trade-off, a
conceptual vocabulary, or an artifact that opens a new design space.

A good HCI contribution is not "only HCI" in a narrow sense. It is a
contribution about interaction: how people understand, use, coordinate around,
resist, appropriate, trust, misuse, or reshape technology.

## AI makes this sharper

This feels especially important now because AI makes it easier to build
plausible demos.

In the past, building a system could itself be strong evidence of technical
imagination. Now, many prototypes can be assembled quickly with LLM APIs, prompt
chains, generated UI code, and existing infrastructure.

That does not make artifact or system research obsolete. But it does raise the
bar for what the artifact needs to show.

"AI applied to X" is usually not enough.

A weak artifact claim might be:

> We built a GenAI tool for designers, and users liked it better than the
> baseline.

A stronger artifact claim might be:

> We built an artifact that externalizes AI-generated alternatives into editable
> design dimensions, making trade-offs visible and negotiable for teams.

The difference is that the second version names a reusable interaction idea.
The system is not just a product. It is a research object.

An HCI artifact contribution is not a worse product. It is a different kind of
object. A product asks whether something is useful, reliable, scalable,
desirable, and worth shipping. A research artifact asks what new interaction
possibility, representation, workflow, architecture, or design trade-off this
prototype makes visible.

A prototype can be rough and still be valuable if it makes an idea inspectable.
But a rough prototype with a vague claim is just a rough prototype.

## The prototype should train the researcher too

Minas Karamanis's essay
[_The machines are fine. I'm worried about us._](https://ergosphere.blog/posts/the-machines-are-fine/)
gave me another way to think about this.

The question is not simply whether AI should or should not be used in research.
The harder question is what kinds of work we are allowing AI to replace, and
what kinds of human capacities we are still trying to develop.

Karamanis makes this vivid through the contrast between Alice and Bob. From the
outside, both can produce something that looks like successful research. But
only one may have gone through the slow process of reading carefully, getting
confused, debugging, checking assumptions, and learning what a good or bad
result feels like. The visible output can be similar while the internal
development is completely different.

That distinction matters for HCI prototyping too. Two researchers can end up
with similar demos, but only one may have built the judgment needed to explain,
critique, debug, and defend the artifact. If AI helps with syntax, prose,
interface polish, or generating alternatives after I already understand the
problem, that seems useful. I am still responsible for the intellectual work.

Where I become uncomfortable is when AI chooses the method, interprets the
data, writes the claim, or smooths away the struggle before I have understood
what the struggle is teaching me. Karamanis's phrase that "the failures are the
curriculum" feels right here. Some friction is waste, but some friction is how
taste develops: the confusing paper, the broken prototype, the weird user
behavior, the bug that reveals a missing model of interaction.

This connects to something my undergraduate advisor Judy once told me: in a
very high-dimensional design space, one goal of research is to become a more
efficient navigator. AI can help with that. It can eliminate bad options,
surface alternatives, speed up implementation, and give me more things to
compare. But the researcher still has to learn where to point the tool, what to
trust, what to reject, and what is worth understanding more deeply.

## Prototype as probe

The most useful shift for me is this:

> Do not prototype only to make a better tool. Prototype to better understand
> people, and to train my own ability to notice what matters about them.

Instead of starting with:

> What tool can I build?

I want to start with:

> What human process am I trying to understand or change?

That process might be comparing alternatives, forming shared understanding,
negotiating trade-offs, critiquing ideas, converging on decisions, preserving
agency, calibrating trust, or maintaining ownership.

Then I can ask:

> What interaction mechanism might change that process?

The mechanism might be externalized design dimensions, contrastive examples,
editable rationales, structured critique, shared design-space maps, provenance
traces, role-based prompting, progressive disclosure, or representations that
preserve useful ambiguity.

The artifact becomes valuable when it makes the mechanism concrete enough to
inspect, use, and evaluate.

This is also how I read Karla Felix Navarro, Eugene Syriani, and Ian Arawjo's
guidelines for reporting LLM-integrated systems in HCI. Their practical advice
is not just "document every prompt." It is to help reviewers understand what
the LLM is doing, why it belongs in the system, and how much the claim depends
on it. That feels like the reporting version of prototype-as-probe: frame the
work around the human process or interaction idea, not around "an LLM solved
X." If the LLM is central, then the paper owes readers enough detail about
prompts, configuration, engineering process, robustness, and failure modes to
judge the claim. If the LLM is only an implementation detail, then maybe the
more durable contribution is the user understanding, design principle, or
interaction pattern that will still matter when the model changes.

This also changes how I think about studies. The study is not only product
validation. It is a way to stress-test a claim about human activity. A prototype
can help reveal what users notice, what they ignore, how they make decisions,
where they lose agency, what trade-offs they care about, and what breakdowns
happen in practice.

The prototype is not the endpoint. It is a probe.

## What survives after the prototype dies?

The test I want to use is:

> If the prototype dies, what knowledge remains?

A weak answer is:

> Users preferred our system.

A better answer is:

> Externalizing design dimensions helped teams move from output-level
> preference talk to attribute-level trade-off reasoning.

An even better answer includes a boundary or trade-off:

> Externalizing design dimensions helped teams compare and converge, but
> sometimes narrowed exploration by imposing criteria too early.

This kind of claim feels more durable. Other people can reuse it, test it,
disagree with it, or build better systems from it.

It also helps me avoid confusing product improvement with research contribution.
If the only thing that survives is "our tool was better," I may have built
something useful, but I have not yet made clear what the research community can
learn from it.

## Evidence should match the claim

Another lesson from Wobbrock and Kientz's paper is that contribution types
should be judged differently.

If the contribution is empirical, the evidence needs to support the finding. If
the contribution is an artifact, the paper needs to show what the artifact makes
possible and why the design is insightful. If the contribution is methodological,
the method needs to be useful, reproducible, reliable, and valid. If the
contribution is theoretical, it needs to explain or organize something in a way
that has power beyond a single example. If the contribution is an argument, it
needs to be fair, persuasive, and grounded.

Sutton and Staw's
[_What Theory Is Not_](https://doi.org/10.2307/2393788) sharpens this point.
References, data, lists of variables, diagrams, and hypotheses can all support
theory, but none of them are theory by themselves. The theoretical work is the
explanation: why the relationship should hold, what mechanism connects the
pieces, and where the claim should break.

For HCI artifact work, this is a useful guardrail. A prototype is not theory. A
positive study result is not theory. A clean system diagram is not theory. The
theory is the account of why this interaction mechanism changes this human
activity under these conditions.

This connects to Dan R. Olsen Jr.'s
[_Evaluating User Interface Systems Research_](https://dl.acm.org/doi/10.1145/1294211)
and Saul Greenberg and Bill Buxton's
[_Usability Evaluation Considered Harmful (Some of the Time)_](https://dl.acm.org/doi/10.1145/1357054.1357074).
A user study is not automatically the right validation for every system
contribution. Sometimes a premature or poorly matched evaluation can obscure
what is actually interesting about a system.

The point is not "avoid evaluation." The point is:

> Evaluate the claim, not just the interface.

## A formula I want to use

When planning a project, I want to fill in this sentence:

> This project contributes a `[type of contribution]` by showing
> `[knowledge claim]` through `[artifact/study/method]`, and it should be
> evaluated by `[appropriate standard]`.

For an artifact or system contribution:

> This project contributes an artifact that demonstrates
> `[new interaction possibility]` by implementing `[specific mechanism]` for
> `[human activity/context]`. The artifact shows that
> `[previously hard thing]` can become
> `[possible/easier/inspectable/contestable/collaborative]`, while exposing the
> trade-off between `[A]` and `[B]`.

For example:

> This project contributes an artifact that demonstrates design-space-based
> interaction with generative AI. By implementing editable dimensions,
> alternative clustering, and rationale-linked comparison, the system makes
> AI-generated design options inspectable and negotiable by teams. The artifact
> exposes a trade-off between structuring exploration and preserving open-ended
> creativity.

I should be careful with projects whose main claim is:

> We built a better AI tool and users performed better.

That can be useful, but it risks becoming lower-efficiency product engineering.

I should also be careful with:

> We borrowed a trick from another literature and put it into an HCI system.

That can be good research, but only if the project tests something non-obvious
about how that mechanism behaves in a new context. The stronger version is:

> This known mechanism should behave differently in this human-AI setting
> because the task, agency structure, uncertainty, or collaboration pattern is
> different.

Then the contribution is not just the borrowed trick. The contribution is the
translation, boundary condition, and explanation.

One theory-specific check I want to keep near the formula:

> Am I explaining the mechanism, or only listing references, variables,
> diagrams, results, or hypotheses?

Two extra checks I want to add, especially when AI is involved:

> What difficulty am I intentionally preserving because it helps me build
> judgment?

> Could I still explain, evaluate, and defend this result if the AI assistance
> disappeared?

That is the distinction I want to keep in view: not whether a prototype is
impressive by itself, but whether it helps articulate a piece of interaction
knowledge that can outlive the prototype.

## Related notes

Don Norman's [_Beyond Human Categories_](https://donnorman1.substack.com/p/beyond-human-categories)
helped me think about this from another angle: maybe the important question is
not whether AI is specialist or generalist, but what kind of distributed
cognitive system we are building around it. I wrote a short follow-up here:
[specialists, generalists, and AI as distributed cognition](/blog/2026/specialists-generalists-ai-distributed-cognition/).

I started a small collection of
[technical papers i want to remember](/blog/2026/technical-papers-i-want-to-remember/).
The first note is on _Locality in Image Diffusion Models Emerges from Data
Statistics_, which gave me a sharper way to ask where an AI system's behavior
comes from: the model, the data, the interface, the task, the evaluation setup,
or the larger arrangement around it.

## Credits and references

This note came out of conversations with mentors and labmates.

[Dev](https://hayatpur.dev/) pointed me to Wobbrock and Kientz's paper.

[Zhiqing](https://www.zhiqingwang.me/) gave me a helpful framing about
companies often using knowledge as input, while research should output knowledge
that others can reuse.

[Philip Guo](https://pg.ucsd.edu/) recommended Karamanis's essay in his
graduate seminar, which helped me connect AI use with researcher judgment and
training.

Main references:

- [Jacob O. Wobbrock](https://faculty.washington.edu/wobbrock/) and
  [Julie A. Kientz](https://www.hcde.washington.edu/kientz).
  [_Research Contributions in Human-Computer Interaction_](https://dl.acm.org/doi/10.1145/2907069).
  _interactions_, 2016.
- Robert I. Sutton and Barry M. Staw.
  [_What Theory Is Not_](https://doi.org/10.2307/2393788).
  _Administrative Science Quarterly_, 40(3), 371-384, 1995.
  [MIT-hosted PDF](https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Doctoral_Resources/Sutton_Staw_What%20theory%20is%20not.pdf).
- Dan R. Olsen Jr.
  [_Evaluating User Interface Systems Research_](https://dl.acm.org/doi/10.1145/1294211).
  UIST 2007.
- Saul Greenberg and Bill Buxton.
  [_Usability Evaluation Considered Harmful (Some of the Time)_](https://dl.acm.org/doi/10.1145/1357054.1357074).
  CHI 2008.
- Karla Felix Navarro, Eugene Syriani, and Ian Arawjo.
  [_Reporting and Reviewing LLM-Integrated Systems in HCI: Challenges and Considerations_](https://arxiv.org/abs/2602.05128).
  arXiv preprint, 2026.
  [Companion guidelines](https://ianarawjo.github.io/Guidelines-for-Reporting-LLM-Integrated-Systems-in-HCI/).
- Minas Karamanis.
  [_The machines are fine. I'm worried about us._](https://ergosphere.blog/posts/the-machines-are-fine/).
  March 30, 2026.

---

Last updated: June 28, 2026.
