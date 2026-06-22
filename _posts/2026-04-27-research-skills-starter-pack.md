---
layout: post
title: research skills starter pack
date: 2026-04-27 09:00:00
description: An ongoing self-study list for learning research reading, project scoping, writing, reviewing, Ph.D. life, and empirical methods.
tags: research writing phd methods qualitative statistics modeling mentorship
categories: guides
related_posts: false
blog_nav_pool: personal
blog_nav_track: research
blog_nav_stage: 2
blog_nav_next:
  - /blog/2026/prototyping-to-understand-humans/
permalink: /blog/2026/research-skills-starter-pack/
---

Getting started in research is not just about joining a lab.

It is also about slowly building the invisible skills that make research work
feel less mysterious: how to read, how to scope a project, how to write, how to
run a study, how to interpret evidence, and how to stay alive through long,
uncertain projects.

This is a small starter pack I point students to when they ask, "What should I
learn on my own before, during, or after joining a research project?"

It is not a complete syllabus. It is a map.

It is also an ongoing thing. I will keep updating this post when I run into
more resources that feel genuinely helpful.

Related note: I also wrote a more reflective piece on what counts as good HCI
research now that AI makes prototyping easier:
[prototyping to understand humans]({% link _posts/2026-05-13-prototyping-to-understand-humans.md %}).

## 1. Learn to read research papers

Reading papers is its own skill. You are not supposed to understand every paper
perfectly on the first pass, and you are not supposed to read every paper with
the same level of attention.

Prof. [Philip Guo](https://pg.ucsd.edu/) recommended two resources to me that
are especially helpful here.

The first is [Srinivasan Keshav](https://cs.uwaterloo.ca/about/people/srinivasan-keshav)'s
[_How to Read a Paper_](https://web.stanford.edu/class/ee384m/Handouts/HowtoReadPaper.pdf).
Keshav describes a three-pass method: first get the shape of the paper, then
understand the content, then go deep enough to reconstruct and critique it. This
is useful because it gives you permission to read strategically instead of
getting stuck on page one.

The second is [Jacob O. Wobbrock](https://faculty.washington.edu/wobbrock/)'s
[_Catchy Titles Are Good: But Avoid Being Cute_](https://faculty.washington.edu/wobbrock/pubs/Wobbrock-2015.pdf),
which is a very useful guide to how SIGCHI-style HCI papers are typically
structured. Even though it is written as a paper-writing guide, it is also great
for reading because it teaches you what each section is trying to do: abstract,
introduction, related work, method, results, discussion, limitations, and
contribution.

When you read a paper, try to answer:

- What kind of paper is this?
- What problem or opportunity motivates it?
- What is the main contribution?
- What evidence supports the contribution?
- What assumptions does the paper make?
- What would I need to believe for this paper to be convincing?
- What would I do differently if I were designing the study or system?

Reading well is not passive. You are reconstructing the research.

## 2. Learn to define and refine a research direction

A topic, a technology, or a proposed system is not yet a research problem. If I
say, "use technique X to do Y," I have mostly described a solution shape. A
problem-shaped version sounds more like: "people currently cannot do Y reliably
under these conditions." Those are different decisions. Choosing a direction is
about deciding what gap, confusion, or possibility is worth understanding.
Implementing a solution is only one way to test whether that direction is real.

[Marco Tulio Ribeiro's essay on coming up with research ideas](https://medium.com/@marcotcr/coming-up-with-research-ideas-3032682e5852)
helped me put language around this. One way to find directions is to expand the
"adjacent possible": build broad awareness of nearby areas, while going deep
enough in your own area that you can notice non-obvious connections. I also
like the practice of keeping a list of important problems or questions that
keep pulling my attention back. That list changes what I notice when I read,
watch talks, or debug prototypes.

Failures are especially useful here. When something breaks, behaves strangely,
or keeps annoying me, the easy move is to find a workaround and forget it. A
better research habit is to write it down before it normalizes. Confusing
observations often point to a missing concept, weak assumption, or hidden
workflow that other people may also be struggling with. Analogies can help too,
but not as "apply technique X to domain Y." The useful work is asking where the
analogy holds, where it breaks, and what the break teaches. Similarly,
challenging a status quo is only interesting after I understand why it became
the status quo in the first place.

Ribeiro gives a nice example from the path to
[LIME](https://arxiv.org/abs/1602.04938). During a Google internship, he had a
model with strong cross-validation accuracy that behaved badly "in the wild,"
and the frustrating part was how much effort it took to understand what the
model was doing. That annoyance became a productive interpretability problem:
how might people understand and evaluate the behavior of models they otherwise
experience as black boxes?

Once I have a possible direction, I want to define it before choosing an
implementation. Ribeiro's
[organizing and evaluating research ideas](https://medium.com/@marcotcr/organizing-and-evaluating-research-ideas-e137637b599e)
framework can be compressed into a checklist:

- What is the problem?
- Why is it important?
- What existing approaches could address it, and why are they insufficient for
  this problem?
- If a useful solution existed, what would it make possible? Describe the
  needed capability before prematurely choosing an implementation.
- How would we know that the problem had been meaningfully addressed?

I would add two follow-on checks:

- What assumptions or uncertainties could invalidate the project?
- What is the cheapest first probe that could reduce the most consequential
  uncertainty?

That probe does not have to be a full system or study. It might be a targeted
literature review, skeptical feedback from collaborators, manually simulating
part of a workflow, testing a crude lower bound, or doing a focused hacking
session. Skeptical feedback is information, not an automatic verdict. If
someone says the idea is flawed, I should ask what would have to be true for
that criticism to be fatal. This also helps with sunk-cost risk: while I am
still reducing uncertainty, I should keep calling the direction a possibility,
not "the project," until there is enough evidence to commit.

### A four-sentence compression test

[Kent Beck's OOPSLA advice](https://www.cs.utexas.edu/~wcook/papers/HowToGetaPaperAcceptedToOOPSLA/HowToGetAPaperAcceptedToOOPSLA.htm)
offers a useful clarity test for a research direction: state the problem,
explain why it matters, state what the work achieves or changes, and state the
implication of that achievement. I like this because it makes vagueness hard to
hide. But it is not a rigid gate. Ribeiro notes that early project formulations
usually change, and his template is more naturally problem-oriented than
exploratory. For exploratory or descriptive work, I would treat the four
sentences as a provisional hypothesis that should evolve as the research teaches
me what the real problem is.

Project selection also has to fit the researcher. A good project for a summer
intern may not be the same as a good project for a Ph.D. student building a
thesis direction. I would look at my goals, available time, skills,
collaborators, data, and institutional resources. For an internship, I value
high upside, fast learning, early tests of fatal assumptions, and credible
partial-success paths. I would not reduce the decision to simple publication
maximization. A safer project is not automatically better, and a high-upside
project is not automatically feasible.

This connects to my companion note on
[prototyping to understand humans]({% link _posts/2026-05-13-prototyping-to-understand-humans.md %}).
After I define the problem, the next question is what reusable knowledge the
artifact, study, or method will produce, and what evidence should support that
claim. The project direction tells me what I am trying to learn before the
prototype makes the answer look obvious.

## 3. Learn to write research clearly

Research writing is not decoration after the "real work" is done. Writing is
where you discover what your contribution actually is, what evidence you still
need, and what your reader is likely to misunderstand.

For technical writing, start with [Tzu-Mao Li](https://cseweb.ucsd.edu/~tzli/)'s
[writing tips](https://cseweb.ucsd.edu/~tzli/writing_tips.html).
I like this page because it is short, direct, and very practical. A few lessons
I especially want students to absorb:

- Know who you are writing for.
- Start early, ideally when the research idea is still forming.
- Explain the "why" before the "what" and "how."
- Put the important points before the implementation details.
- Make figures early and use them to shape the story.
- Treat collaborators' confusion as useful evidence about where readers will
  also get confused.
- Be generous and careful when writing about prior work.

[Tzu-Mao Li](https://cseweb.ucsd.edu/~tzli/) also recommended two writing
resources that I would read after his page. The first is
[Fredo Durand](https://people.csail.mit.edu/fredo/)'s
[_Notes on writing_](https://people.csail.mit.edu/fredo/PUBLI/writing.pdf).
Durand emphasizes something that sounds obvious but is surprisingly easy to
forget: your contribution only matters if people can understand it. His notes
are especially useful for learning how to build a paper around a clear story,
hierarchy of ideas, motivation, overview, figures, and results that support your
claims.

Then read
[Bill Freeman](https://billf.mit.edu/)'s
[_How to write a good CVPR submission_](https://www.cs.ryerson.ca/~wangcs/resources/How-to-write-a-good-CVPR-submission.pdf).
Even if you do not work in computer vision, it is useful because it explains the
reviewer's situation very honestly. Reviewers are busy. Area chairs are often
looking for reasons to reject borderline papers. Your job is not to hope they
figure out your point. Your job is to make the problem, contribution, evidence,
limitations, and relationship to prior work easy to see.

I would also read Marco Tulio Ribeiro's
[_Writing, part 1 — the process_](https://medium.com/@marcotcr/writing-part-1-the-process-6bb92cb522eb).
It is useful because it treats writing as a process for discovering and
organizing thought, not as a final cleanup pass. His loop is deliberately
concrete: dump raw material, outline both top down and bottom up, write an
imperfect draft from that outline, reverse-outline what you actually wrote,
rewrite at multiple levels, and ask for feedback. I like this because it makes
confusion less shameful. If a paragraph collapses when I outline it backward,
that is not a sign that writing failed. That is the writing doing its job.

My practical takeaway from [Tzu-Mao Li](https://cseweb.ucsd.edu/~tzli/)'s
advice, the Durand/Freeman resources he recommended, Ribeiro's process essay,
and my own writing habits:

- Draft the outline before drafting polished paragraphs.
- Make the central figure earlier than feels comfortable.
- Write the first paragraph as if a tired reviewer will only give you 30
  seconds.
- For every section, ask: what does the reader need to believe by the end of
  this?
- For every claim, ask: what evidence makes this believable?
- For every related-work paragraph, ask: am I being accurate, fair, and useful?
- Rewrite more than you think you need to.

Good writing is not about sounding fancy. It is about making the reader's job
easier.

## 4. Learn to review papers generously

Reviewing is another way to learn research taste. A good review does not just
find flaws. It identifies what is valuable, what is missing, what is overstated,
and what would help the work become stronger.

[Ken Hinckley](https://www.microsoft.com/en-us/research/people/kenh/publications/)
recommended his own essay,
[_So You're a Program Committee Member Now: On Excellence in Reviews and Meta-Reviews and Championing Submitted Work That Has Merit_](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/10/Excellence-in-Reviews-MobileHCI-2015-Web-Site.pdf).
It was written for MobileHCI 2015 program committee members, but it is useful
well before you are actually on a program committee.

The big lesson I take from it is that reviewing is a responsibility to the
field, not just an exercise in criticism. Look for the strongest version of a
paper's contribution. Be fair about weaknesses. Separate correctable
presentation problems from deeper research problems. Write in a way that helps
authors improve, especially when you recommend rejection.

When practicing reviews, ask:

- What is the paper trying to contribute?
- What is genuinely valuable here?
- What evidence is strong?
- What evidence is weak or missing?
- What claims are too broad for the evidence?
- What are the most important changes the authors could make?
- Am I being fair to work that is outside my exact taste or method comfort zone?

Writing reviews is also a sneaky way to become a better author. You start to
feel what makes a paper easy or hard to evaluate.

## 5. Learn what Ph.D. life can feel like

If you are considering a Ph.D., you should read about the lived experience, not
just the application process or the highlight reel.

[Philip Guo](https://pg.ucsd.edu/)'s
[_The Ph.D. Grind_](https://cacm.acm.org/blogcacm/the-ph-d-grind-main-grinds-and-side-grinds/)
is valuable because it gives a concrete, personal account of a computer
science Ph.D. journey: uncertainty, advisor fit, failed directions, rebuilding
momentum, publishing, graduating, and making sense of the whole experience
afterward.

Do not read it as universal truth. Every department, advisor, funding structure,
research area, and person is different. Read it as one detailed case study of
how research can feel from the inside.

The main reason I recommend it is that it makes the hidden parts visible.
Research often looks clean after it is published. During the process, it can
feel like false starts, ambiguous feedback, lonely debugging, changing goals,
and small wins that only make sense months later. Knowing that ahead of time can
help you avoid over-interpreting normal struggle as personal failure.

Useful questions to ask while reading:

- What kinds of uncertainty does this person have to tolerate?
- What changes when a project starts to become their own?
- How do mentors, collaborators, and institutions shape the experience?
- What parts of this life sound energizing to me?
- What parts sound costly, and am I honest about that cost?

A Ph.D. can be meaningful and joyful. It can also be hard in ways that are not
obvious from the outside. Both can be true.

## 6. Learn empirical methods, qualitative research, and statistics

For HCI, design, psychology, education, and human-centered AI, methods matter a
lot. If you want to study people, you need to learn how evidence gets made.

This is where statistics is not just a class requirement. It is part of your
research taste. It helps you notice weak comparisons, confounds, underpowered
claims, measurement problems, and conclusions that are stronger than the study
can support.

Prof. [Scott Klemmer](https://d.ucsd.edu/srk/) has recommended reading David W.
Martin's
[_Doing Psychology Experiments_](https://books.google.com/books/about/Doing_Psychology_Experiments.html?id=YzwQAQAAIAAJ)
for learning experimental thinking.

I would use this book to learn the mindset, not only the formulas:

- What is the actual research question?
- What is being manipulated?
- What is being measured?
- What are the dependent and independent variables?
- What are the threats to validity?
- What would a better control condition look like?
- What can this study conclude, and what can it not conclude?

Scott also recommended two qualitative papers as examples of how to turn close
observation into a strong research contribution.

[Janet Vertesi](https://janet.vertesi.com/)'s
[_"Seeing like a rover": Embodied experience on the Mars Exploration Rover mission_](https://dl.acm.org/doi/10.1145/1358628.1358709)
is useful for HCI students because it shows how qualitative work can make a
technical practice socially and bodily legible. The paper is based on two years
of ethnographic fieldwork with the Mars Rover mission, and the lesson for me is
that good qualitative research does not only report what people said. It reveals
the situated practices, metaphors, gestures, tools, and team arrangements that
make a form of work possible.

[Robert I. Sutton](https://www.gsb.stanford.edu/faculty-research/faculty/robert-i-sutton)
and [Andrew Hargadon](https://www.hargadon.net/)'s
[_Brainstorming Groups in Context: Effectiveness in a Product Design Firm_](https://web.mit.edu/~mcyang/www/papers/suttonHargadon96.pdf)
is useful for design research because it asks what effectiveness means inside a
real organization. Instead of treating idea count as the only outcome, the paper
studies brainstorming in context and shows that the practice can support other
organizational functions. The takeaway is a good qualitative habit: before
deciding whether something "works," ask what work it is doing, for whom, and in
what setting.

For quantitative modeling, I would next read Seth Roberts and Harold Pashler's
[_How persuasive is a good fit? A comment on theory testing_](https://pubmed.ncbi.nlm.nih.gov/10789200/).
The title gives away the lesson: a model fitting the observed data is not, by
itself, strong evidence that the model is right. You also need to ask how
flexible the model is, what outcomes it could not have fit, how noisy the data
are, and whether plausible alternative results would have actually challenged
the theory. This is a good guardrail against being dazzled by a clean curve or a
high $R^2$.

Then read Tamar R. Makin and Jean-Jacques Orban de Xivry's
[_Ten common statistical mistakes to watch out for when writing or reviewing a manuscript_](https://elifesciences.org/articles/48175).
This is the piece I would use when a paper's claims feel like they might be
outrunning the design or analysis. It covers recurring problems like inadequate
controls, comparing two effects without directly comparing them, inflated units
of analysis, spurious correlations, small samples, circular analysis, and
overstated null results. The larger habit is simple but hard: make the strength
of the claim match the strength and kind of evidence.

For students entering HCI or human-centered AI, I would pair methods reading
with practice. Take a paper you like and reverse-engineer the study:

- Write the research question in one sentence.
- Identify the claim the study is trying to support.
- Sketch the study design.
- List the variables and measures.
- If the paper is qualitative, identify the field setting, the interpretive
  claim, and the observations that make that claim believable.
- Write down possible confounds.
- Ask what result would have changed your mind.
- Check whether the paper's conclusion matches the evidence.

This exercise is slow at first, but it builds the kind of judgment that makes
you a much stronger collaborator.

## 7. A note on credit

This list credits both the people who recommended resources to me and the people
who wrote those resources:

- [Philip Guo](https://pg.ucsd.edu/) for recommending
  [Srinivasan Keshav](https://cs.uwaterloo.ca/about/people/srinivasan-keshav)'s
  [_How to Read a Paper_](https://web.stanford.edu/class/ee384m/Handouts/HowtoReadPaper.pdf)
  and [Jacob O. Wobbrock](https://faculty.washington.edu/wobbrock/)'s
  [_Catchy Titles Are Good: But Avoid Being Cute_](https://faculty.washington.edu/wobbrock/pubs/Wobbrock-2015.pdf),
  and for writing
  [_The Ph.D. Grind_](https://cacm.acm.org/blogcacm/the-ph-d-grind-main-grinds-and-side-grinds/).
- [Tzu-Mao Li](https://cseweb.ucsd.edu/~tzli/) for his
  [writing tips](https://cseweb.ucsd.edu/~tzli/writing_tips.html) and the
  writing resources he recommended there:
  [Fredo Durand](https://people.csail.mit.edu/fredo/)'s
  [_Notes on writing_](https://people.csail.mit.edu/fredo/PUBLI/writing.pdf)
  and [Bill Freeman](https://billf.mit.edu/)'s
  [_How to write a good CVPR submission_](https://www.cs.ryerson.ca/~wangcs/resources/How-to-write-a-good-CVPR-submission.pdf).
- [Marco Tulio Ribeiro](https://medium.com/@marcotcr) for writing
  [_Writing, part 1 — the process_](https://medium.com/@marcotcr/writing-part-1-the-process-6bb92cb522eb).
- Jo Vermeulen for sharing Marco Tulio Ribeiro's
  [_Coming up with research ideas_](https://medium.com/@marcotcr/coming-up-with-research-ideas-3032682e5852)
  and
  [_Organizing and evaluating research ideas_](https://medium.com/@marcotcr/organizing-and-evaluating-research-ideas-e137637b599e)
  with our Autodesk summer intern group, and for connecting Ribeiro's questions
  to Kent Beck's
  [_How to Get a Paper Accepted at OOPSLA_](https://www.cs.utexas.edu/~wcook/papers/HowToGetaPaperAcceptedToOOPSLA/HowToGetAPaperAcceptedToOOPSLA.htm).
  Thanks, Jo, as always, for another thoughtful pointer.
- [Ken Hinckley](https://www.microsoft.com/en-us/research/people/kenh/publications/)
  for recommending and writing
  [_So You're a Program Committee Member Now_](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/10/Excellence-in-Reviews-MobileHCI-2015-Web-Site.pdf).
- [Scott Klemmer](https://d.ucsd.edu/srk/) for the recommendation to read
  David W. Martin's
  [_Doing Psychology Experiments_](https://books.google.com/books/about/Doing_Psychology_Experiments.html?id=YzwQAQAAIAAJ),
  and [David W. Martin](https://books.google.com/books/about/Doing_Psychology_Experiments.html?id=YzwQAQAAIAAJ)
  for writing it. Scott also recommended two qualitative exemplars:
  [Janet Vertesi](https://janet.vertesi.com/)'s
  [_"Seeing like a rover"_](https://dl.acm.org/doi/10.1145/1358628.1358709)
  and [Robert I. Sutton](https://www.gsb.stanford.edu/faculty-research/faculty/robert-i-sutton)
  and [Andrew Hargadon](https://www.hargadon.net/)'s
  [_Brainstorming Groups in Context_](https://web.mit.edu/~mcyang/www/papers/suttonHargadon96.pdf).
- [Seth Roberts](https://pubmed.ncbi.nlm.nih.gov/10789200/) and
  [Harold Pashler](https://pubmed.ncbi.nlm.nih.gov/10789200/) for
  [_How persuasive is a good fit? A comment on theory testing_](https://pubmed.ncbi.nlm.nih.gov/10789200/).
- [Tamar R. Makin](https://elifesciences.org/articles/48175) and
  [Jean-Jacques Orban de Xivry](https://elifesciences.org/articles/48175) for
  [_Ten common statistical mistakes to watch out for when writing or reviewing a manuscript_](https://elifesciences.org/articles/48175).

Research is a craft. The nice thing about craft is that you can practice it
before anyone gives you permission.

---

Last updated: June 22, 2026.
