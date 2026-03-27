---
layout: about
title: about
permalink: /
panel_wide: true
subtitle: <a href='#'>Affiliations</a> University of California San Diego

profile:
  align: right
  image: sirui_pic.jpg
  image_hovers:
    - sirui_pic_ghbili.png
    - sirui_pic_rick_and_morty.png
    - sirui_pic_south_park.png
    - sirui_pic_simpsons.png
  image_circular: true # crops the image to make it circular
  more_info: >
    <p>9510 Innovation Ln, La Jolla,</p>
    <p>CA 92093, USA</p>

selected_papers: true # includes a list of papers marked as "selected={true}"
social: true # includes social icons at the bottom of the page

announcements:
  enabled: true # includes a list of news items
  scrollable: true # adds a vertical scroll bar if there are more than 3 news items
  limit: 5 # leave blank to include all the news in the `_news` folder

latest_posts:
  enabled: false
  scrollable: true # adds a vertical scroll bar if there are more than 3 new posts items
  limit: 3 # leave blank to include all the blog posts
---

Hello visitor, Sirui here! 👋 (pronounced like “three”)

I'm a first-year Ph.D. student in the Cognitive Science Department at UC San Diego, advised by [Prof. Steven P. Dow](https://spdow.ucsd.edu/) ([ProtoLab](https://protolab.ucsd.edu/)). I build tools that **augment human capabilities**—especially how people **think, design, and make**—using human-centered AI and mixed reality. ⚡

**Research Focus (2026)**

- **Human–AI for Design** 🧠🎨 — Designing interfaces and systems that help people explore, compare, and refine generative possibilities in more diverse, legible, and grounded ways—while also supporting stronger taste and judgment in creative work.
- **AI & Mixed Reality for Augmentation** 🥽 — Building interactive systems that support everyday tasks through in-situ intelligence, spatial interaction, and real-world use.
- **Method** 📐 — Build → measure: designing systems, studying how people use them, and developing metrics for diversity, verification cost, and appropriate reliance.

**Domains I Love Applying This To**

Urban design, architecture, interior & product design, fashion, robotics, and education—places where ideas move from **vibes → variables → value**. ✨

**Exploring**

- Developing taste and judgment 🧐 in AI-supported creative work ([cr. Don](https://dylantao.github.io/blog/2026/don-norman-design-lab-talk/))
- Embodied systems 🤖 integrated into everyday life
- Post-deployment iteration 🌍 to maximize benefit and minimize harm
- Learner-centered generative AI 📚 for education at scale
- Community-centered tools 🤝 for real-world collaboration

**Research Opportunities @ ProtoLab** 🧪

I’m always excited to work with curious, motivated, and kind undergraduate and master’s students. As generative AI expands what one person can build, prototype, and investigate, I’m especially interested in working with driven students who have genuine research curiosity and real passion for a domain, problem space, or question they care about.

You do not need to already be an expert in every part of research. I value people who want to grow into thoughtful, well-rounded researchers—people who are excited to develop taste, judgment, and craft over time, and who are willing to learn across reading, ideation, prototyping, evaluation, analysis, and communication.

**Ready to apply?** Email me at **s1tao@ucsd.edu** with subject **"UCSD Research Interest"** and include a **1-page CV/resumé** (plus a portfolio link, if relevant). In your email, please include a short **3–5 sentence note** on why you think you’d be a good fit—your interests, relevant experience, the domain or question you care about, and what you hope to learn. Please also include a brief **"Why I’m a fit"** line or section in your CV/resumé so I can quickly understand your interests and goals.

I’m happy to chat once I have that quick snapshot!

**Advisor Lineage & Past Collaborations**

- Ph.D.: **[Steven P. Dow](https://spdow.ucsd.edu/)** (HCI)
- Master's: **[Steven P. Dow](https://spdow.ucsd.edu/)** (HCI) & **[Tzu-Mao Li](https://cseweb.ucsd.edu/~tzli/)** (Graphics)
- Undergrad: **[Judith E. Fan](https://profiles.stanford.edu/judith-fan)** (Cognition & Intuitive Physics)

---

If you're excited about this space, let's chat. 🚀

<script>
document.addEventListener("DOMContentLoaded", function() {
  const container = document.getElementById('profile-image-container');
  if (container) {
    const hoverLayer = container.querySelector('.profile-image-hover-layer');
    const images = container.getAttribute('data-images').split(',');
    if (!hoverLayer || images.length === 0) return;
    hoverLayer.style.backgroundImage = `url("${images[0]}")`;
    container.addEventListener('mouseenter', function() {
      const randomImage = images[Math.floor(Math.random() * images.length)];
      hoverLayer.style.backgroundImage = `url("${randomImage}")`;
    });
  }
});
</script>
