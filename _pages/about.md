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

Hello visitor, Sirui here!👋 (pronounced as "three")

I am an incoming Ph.D. student in Cognitive Science Department at the UC San Diego. My broad research interest lies in leveraging technological advancements to better augment human capabilities.

Currently, my main research interests are:

1. **HAI and Design**
2. **AI and Mixed Reality for User Experience Augmentation**

More specifically:

1. Enabling creative professionals 👨‍🎨 to leverage AI tools 🧠 for their design tasks 🖼️, from both HCI and Graphics perspectives.
2. Using spatial intelligence and Mixed Reality to augment individuals both in their everyday experience and professional workflow 😎.

Additionally, I am open to explore (listed in order of my passion for each topic):

- Studying how to smoothly incorporate embodied (semi-)autonomous systems 🤖 into people's everyday lives.
- Iteratively improving AI solutions post-deployments in real world 🌍 to maximize benefits while minimizing harm.
- Scaling affordable and accessible learning resources 📚 for all, with perosnalized and engaging interactions enabled by learner-centric generative AI ✨.
- Creating more inclusive 🤝 and effective support for community-centered work 🏘️, enabled by the emergence of AI advancements.

During my Ph.D., I will continue my research in HCI under the guidance of [Prof. Steven Dow](https://spdow.ucsd.edu/). Throughout my Master's program, I collaborated with [Prof. Steven Dow](https://spdow.ucsd.edu/) on HCI and [Prof. Tzu-Mao Li](https://cseweb.ucsd.edu/~tzli/) on Graphics. In my undergraduate studies, I had the great fortune to work with [Prof. Judith E. Fan](https://profiles.stanford.edu/judith-fan) on Intuitive Physics.

If you want to chat, free to contact me via any of the social links at the bottom of the page.

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
