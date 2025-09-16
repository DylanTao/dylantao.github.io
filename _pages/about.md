---
layout: about
title: about
permalink: /
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
    <p>9510 Innovation Ln,</p>
    <p>La Jolla, CA 92093, USA</p>

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

I’m a **first-year Ph.D. student** in the Cognitive Science Department at **UC San Diego**, advised by **[Prof. Steven Dow](https://spdow.ucsd.edu/)** ([ProtoLab](https://protolab.ucsd.edu/)). I build tools that **augment human capabilities**—especially how people **think, design, and make**—using human-centered AI and mixed reality. ⚡



**Research Focus (2025)**

- **Human–AI for Design** 🧠🎨 — Building interfaces and workflows that keep generative alternatives **diverse, legible, and verifiable** (not just pretty). I explore structured variation, aligned comparison, and lightweight language scaffolds that make consequential differences obvious.
- **AI & Mixed Reality for Augmentation** 🥽📐 — **In-situ** support for everyday and professional tasks, with attention to **accessibility** (e.g., environment cues for low-vision users) and **spatial intelligence** that works beyond the demo room.
- **Method** 🧪 — Build → measure: controlled variation in interfaces, mixed-methods evaluation (reflexive thematic analysis + pragmatic quant), and metrics like **dispersion/diversity**, **verification cost**, and **appropriate reliance**.

**Domains I Love Applying This To**
- Urban design, architecture, interior & product design, fashion, robotics, accessibility, and education tech—places where ideas move from **vibes → variables → value**. ✨

**Additionally Exploring**
- Smooth integration of **embodied (semi-)autonomous systems** 🤖 into everyday life.  
- **Post-deployment iteration** in the wild 🌍 to maximize benefit and minimize harm.  
- **Accessible, affordable learning** at scale 📚 with learner-centric generative AI.  
- **Community-centered, inclusive tools** 🤝 for real-world collaboration 🏘️.



**Research Opportunities @ ProtoLab** 🧪

Seeking curious, motivated, and kind undergraduate & master's students to join our research team! Whether you're just starting your academic journey or nearing graduation, we welcome students from all years and departments. Choose your focus or explore both tracks:

**Two Tracks**
- **Quant Track** (coding/ML/AR-VR/metrics) 🧩  
  Prototype interfaces (React/TS), XR interactions (Unity/C#), light graphics/vision, LLM/VLM pipelines, and analysis (Python/pandas/matplotlib). Help design metrics for diversity & verification cost.

- **Quali Track** (UI/UX/interviews/analysis) ✍️  
  Shape flows and affordances, run user studies (IRB → pilot), conduct interviews, do reflexive thematic analysis, and craft honest figures/captions.

(Interested in both? Great. Unsure but passionate about these themes? Also great.)

**How to contact (please be concise):**  
Email me (s1tao@ucsd.edu) with subject **“UCSD Research – Quant / Quali / Both”** and include:
- A **1-page CV/resumé** or portfolio link 🔗  
- A **3–5 sentence TL;DR** on why you’re a fit (interests, skills, what you want to learn) 📨

I’m happy to chat once I have that quick snapshot!


**Advisor Lineage & Past Collaborations**
- Ph.D.: **[Steven Dow](https://spdow.ucsd.edu/)** (HCI, ProtoLab)  
- Master's: **[Steven Dow](https://spdow.ucsd.edu/)** (HCI) & **[Tzu-Mao Li](https://cseweb.ucsd.edu/~tzli/)** (Graphics)  
- Undergrad: **[Judith E. Fan](https://profiles.stanford.edu/judith-fan)** (Cognition & Intuitive Physics)

---

If you’re excited about this space, **let’s chat**. 🚀


<script>
document.addEventListener("DOMContentLoaded", function() {
  const container = document.getElementById('profile-image-container');
  if (container) {
    const images = container.getAttribute('data-images').split(',');
    container.addEventListener('mouseenter', function(){
      const randomImage = images[Math.floor(Math.random() * images.length)];
      container.style.backgroundImage = `url(${randomImage})`;
    });
  }
});
</script>
