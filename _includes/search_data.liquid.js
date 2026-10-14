{%- comment -%}
  The command palette's data (ninja-keys), rendered inline by _includes/scripts.liquid. The site curates
  it instead of using al_search's generic template: "Start here" routes, "Do" actions that call the
  site's own controls, writing, projects, and contact. It moved here from _scripts/, which v1 no longer
  builds, so the curated palette had silently fallen back to the plugin's defaults.
{%- endcomment -%}
const ninja = document.querySelector('ninja-keys');

ninja.data = [
  {
    id: "quick-research",
    title: "research overview",
    description: "Overview of Sirui Tao's research thesis, focus areas, projects, publications, and design judgment work.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/#taste' | relative_url }}";
    },
  },
  {
    id: "quick-thesis",
    title: "Research thesis: Scaffolding for Taste",
    description: "Sirui Tao research thesis taste design judgment human-centered AI generative AI value tradeoffs evidence.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/#taste' | relative_url }}";
    },
  },
  {
    id: "quick-focus",
    title: "Research focus: design, evaluate, situate",
    description: "Research directions design evaluation situated mixed reality embodied systems interfaces.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/#focus' | relative_url }}";
    },
  },
  {
    id: "quick-students",
    title: "Student research opportunities",
    description: "Prospective students interns undergraduate master's research opportunity UCSD ProtoLab apply email interest.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/#students' | relative_url }}";
    },
  },
  {
    id: "quick-student-post",
    title: "How to start doing research at UC San Diego",
    description: "Student intern undergraduate master's research-start post how to contact Sirui about research.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/blog/2026/how-to-start-doing-research-at-ucsd/' | relative_url }}";
    },
  },
  {
    id: "quick-contact",
    title: "Contact Sirui",
    description: "Email contact connect LinkedIn GitHub Bluesky X social profiles.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/#connect' | relative_url }}";
    },
  },
  {
    id: "quick-cv",
    title: "CV",
    description: "Curriculum vitae resume honors awards education publications experience references.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/cv/' | relative_url }}";
    },
  },
  {
    id: "quick-cv-pdf",
    title: "CV PDF",
    description: "Download Sirui Tao CV PDF curriculum vitae resume.",
    section: "Start here",
    handler: () => {
      window.open("{{ site.data.socials.cv_pdf | relative_url }}", "_blank");
    },
  },
  {
    id: "quick-projects",
    title: "Projects",
    description: "DesignWeaver HotSpot Physion GraphHSCN Context-Aware Encoding project portfolio prototypes systems.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/projects/' | relative_url }}";
    },
  },
  {
    id: "quick-publications",
    title: "Publications",
    description: "Papers CHI UIST CSCW research publications bibliography.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/publications/' | relative_url }}";
    },
  },
  {
    id: "quick-updates",
    title: "Recent updates",
    description: "News announcements recent updates Sirui Tao.",
    section: "Start here",
    handler: () => {
      window.location.href = "{{ '/news/' | relative_url }}";
    },
  },
  /* Actions click or call the site's own controls, so each state keeps one source of truth. */
  {%- assign theme_actions = "morning|Morning light;noon|Noon light;afternoon|Afternoon light;evening|Evening, the dark theme" | split: ";" -%}
  {%- for action in theme_actions -%}
    {%- assign parts = action | split: "|" -%}
    {
      id: "do-theme-{{ parts[0] }}",
      title: "Theme: {{ parts[0] }}",
      description: "Switch the time-of-day theme. {{ parts[1] }}.",
      section: "Do",
      keywords: "theme time of day color {{ parts[0] }}",
      handler: () => {
        if (typeof setThemeSetting === "function") setThemeSetting("{{ parts[0] }}");
      },
    },
  {%- endfor %}
  {
    id: "do-motion",
    title: "Pause motion, or resume it",
    description: "Still the ambient animation across the site: the 3D home, duh, the coast and the sketches.",
    section: "Do",
    keywords: "motion pause animation reduce still accessibility",
    handler: () => {
      window.siteMotion?.setPaused(!window.siteMotion.paused);
    },
  },
  {
    id: "do-desk-3d",
    title: "Open the 3D home",
    description: "Walk around Sirui's coastal home in 3D.",
    section: "Do",
    keywords: "3d scene house desk la jolla",
    handler: () => {
      const button = document.querySelector('[data-home-desk-mode="3d"]');
      if (button) {
        button.scrollIntoView({ block: "center" });
        button.click();
        return;
      }
      try {
        sessionStorage.setItem("sirui-scene-mode", "3d");
      } catch {
        /* Without storage the homepage opens in 2D. */
      }
      window.location.href = "{{ '/#start' | relative_url }}";
    },
  },
  {
    id: "do-ai-format",
    title: "Read this page as AI-readable text",
    description: "Open the plain, machine-readable counterpart of this page.",
    section: "Do",
    keywords: "ai format markdown machine readable llm",
    handler: () => {
      const link = document.querySelector('[data-site-format="ai"]');
      window.location.href = link ? link.href : "{{ '/ai/' | relative_url }}";
    },
  },
  {
    id: "do-duh-recall",
    title: "Call duh over",
    description: "Bring the page companion back beside you.",
    section: "Do",
    keywords: "companion duh recall",
    handler: () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "D", code: "KeyD", altKey: true, shiftKey: true, bubbles: true }));
    },
  },
  {
    id: "do-duh-sleep",
    title: "Let duh sleep, or wake it",
    description: "Pause or resume the page companion.",
    section: "Do",
    keywords: "companion duh pause sleep motion",
    handler: () => {
      document.querySelector(".duh-hit")?.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    },
  },
  {
    id: "do-build-rhythm",
    title: "Open Build Rhythm",
    description: "Sirui's code activity across the years, by day and by week.",
    section: "Do",
    keywords: "github commits activity code history",
    handler: () => {
      window.location.href = "{{ '/github-activity/' | relative_url }}";
    },
  },
  {
    id: "quick-student-email",
    title: "Email research interest",
    description: "Student intern research opportunities email Sirui at s1tao@ucsd.edu with UCSD Research Interest.",
    section: "Contact",
    handler: () => {
      window.location.href = "mailto:s1tao@ucsd.edu?subject=UCSD%20Research%20Interest";
    },
  },
  {%- assign sorted_pages = site.pages | sort: "nav_order" -%}
  {%- for p in sorted_pages -%}
    {%- if p.nav and p.autogen == null and p.search != false -%}
      {%- if p.dropdown -%}
        {%- for child in p.children -%}
          {%- unless child.title == 'divider' -%}
            {
              {%- assign title = child.title | escape | strip -%}
              {%- if child.permalink contains "/blog/" -%}{%- assign url = "/blog/" -%} {%- else -%}{%- assign url = child.permalink -%}{%- endif -%}
              id: "nav-{{ title | slugify }}",
              title: "{{ title | truncatewords: 13 }}",
              description: "{{ child.description | strip_html | strip_newlines | escape | strip }}",
              section: "Navigation",
              handler: () => {
                window.location.href = "{{ url | relative_url }}";
              },
            },
          {%- endunless -%}
        {%- endfor -%}
      {%- else -%}
        {
          {%- assign title = p.title | escape | strip -%}
          {%- if p.permalink contains "/blog/" -%}{%- assign url = "/blog/" -%} {%- else -%}{%- assign url = p.url -%}{%- endif -%}
          id: "nav-{{ title | slugify }}",
          title: "{{ title | truncatewords: 13 }}",
          description: "{{ p.description | strip_html | strip_newlines | escape | strip }}",
          section: "Navigation",
          handler: () => {
            window.location.href = "{{ url | relative_url }}";
          },
        },
      {%- endif -%}
    {%- endif -%}
  {%- endfor -%}
  {%- if site.posts_in_search -%}
    {%- for post in site.posts -%}
      {%- if post.search != false -%}
        {
          {%- assign title = post.title | escape | strip -%}
          id: "post-{{ title | slugify }}",
          {% if post.redirect == blank %}
            title: "{{ title | truncatewords: 13 }}",
          {% elsif post.redirect contains '://' %}
            title: '{{ title | truncatewords: 13 }} <svg width="1.2rem" height="1.2rem" top=".5rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="#999" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
          {% else %}
            title: "{{ title | truncatewords: 13 }}",
          {% endif %}
          description: "{{ post.description | strip_html | strip_newlines | escape | strip }}",
          section: "Writing",
          handler: () => {
            {% if post.redirect == blank %}
              window.location.href = "{{ post.url | relative_url }}";
            {% elsif post.redirect contains '://' %}
              window.open("{{ post.redirect }}", "_blank");
            {% else %}
              window.location.href = "{{ post.redirect | relative_url }}";
            {% endif %}
          },
        },
      {%- endif -%}
    {%- endfor -%}
  {%- endif -%}
  {%- assign sorted_projects = site.projects | sort: "importance" -%}
  {%- for item in sorted_projects -%}
    {%- if item.search != false -%}
      {
        {%- assign title = item.title | newline_to_br | replace: "<br />", " " | replace: "<br/>", " " | strip_html | strip_newlines | escape | strip -%}
        id: "project-{{ title | slugify }}",
        title: "{{ title | truncatewords: 13 }}",
        description: "{{ item.description | strip_html | strip_newlines | escape | strip }}",
        section: "Projects",
        handler: () => {
          window.location.href = "{{ item.url | relative_url }}";
        },
      },
    {%- endif -%}
  {%- endfor -%}
  {%- comment -%} The preferred contact, never the older address in socials.yml. {%- endcomment -%}
  {%- if site.profile_contact_email -%}
    {
      id: "contact-email",
      title: "Email Sirui",
      description: "Email contact Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.location.href = "mailto:{{ site.profile_contact_email }}";
      },
    },
  {%- endif -%}
  {%- if site.data.socials.github_username -%}
    {
      id: "contact-github",
      title: "GitHub",
      description: "Code repositories projects GitHub Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.open("https://github.com/{{ site.data.socials.github_username }}", "_blank");
      },
    },
  {%- endif -%}
  {%- if site.data.socials.linkedin_username -%}
    {
      id: "contact-linkedin",
      title: "LinkedIn",
      description: "Professional profile contact collaborator LinkedIn.",
      section: "Contact",
      handler: () => {
        window.open("https://www.linkedin.com/in/{{ site.data.socials.linkedin_username }}", "_blank");
      },
    },
  {%- endif -%}
  {%- if site.data.socials.scholar_userid -%}
    {
      id: "contact-scholar",
      title: "Google Scholar",
      description: "Scholar citations papers academic publications.",
      section: "Contact",
      handler: () => {
        window.open("https://scholar.google.com/citations?user={{ site.data.socials.scholar_userid }}", "_blank");
      },
    },
  {%- endif -%}
  {%- if site.data.socials.bluesky_url -%}
    {
      id: "contact-bluesky",
      title: "Bluesky",
      description: "Social updates Bluesky Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.open("{{ site.data.socials.bluesky_url }}", "_blank");
      },
    },
  {%- endif -%}
  {%- if site.data.socials.x_username -%}
    {
      id: "contact-x",
      title: "X / Twitter",
      description: "Social updates X Twitter Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.open("https://x.com/{{ site.data.socials.x_username }}", "_blank");
      },
    },
  {%- endif -%}
];
