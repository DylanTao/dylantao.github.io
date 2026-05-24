// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "publications",
          description: "Papers and workshop pieces, with the current design/HCI thread near the top.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "Research artifacts, prototypes, and studies around design judgment, creative tools, graphics, and embodied interaction.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-blog",
          title: "blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-cv",
          title: "CV",
          description: "Education, research experience, teaching, publications, and the practical version of the story.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "post-what-i-learned-redesigning-my-website-with-an-ai-coding-agent",
        
          title: "what I learned redesigning my website with an AI coding agent",
        
        description: "A short reflection on using Codex, screenshots, and design heuristics to redesign a research portfolio in a day.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/website-redesign-ai-agent/";
          
        },
      },{id: "post-science-communication-is-kindness",
        
          title: "science communication is kindness",
        
        description: "A short reflection on why scientists should communicate publicly, and how to do it with care.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/science-communication-is-kindness/";
          
        },
      },{id: "post-prototyping-to-understand-humans",
        
          title: "prototyping to understand humans",
        
        description: "Some working thoughts on good HCI research in the age of AI.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/prototyping-to-understand-humans/";
          
        },
      },{id: "post-research-skills-starter-pack",
        
          title: "research skills starter pack",
        
        description: "An ongoing self-study list for learning research reading, writing, reviewing, Ph.D. life, and empirical methods.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/research-skills-starter-pack/";
          
        },
      },{id: "post-how-to-start-doing-research-at-ucsd",
        
          title: "how to start doing research at ucsd",
        
        description: "A short note for prospective undergraduate and master&#39;s research interns at UC San Diego.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/how-to-start-doing-research-at-ucsd/";
          
        },
      },{id: "post-an-afternoon-with-don-norman",
        
          title: "an afternoon with don norman",
        
        description: "Don gave a talk at DLab about his charity, signed my Yellow Book, and told us to check out his new book",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/don-norman-design-lab-talk/";
          
        },
      },{id: "post-starting-my-pottery-journey",
        
          title: "starting my pottery journey",
        
        description: "embarking on a pottery journey with ellen fager at ucsd craft center, featuring three commissioned works",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/starting-pottery/";
          
        },
      },{id: "post-a-gallery-of-random-gen-ai-images",
        
          title: "a gallery of random gen-ai images",
        
        description: "a gallery of random gen-ai images",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2024/image-gallery/";
          
        },
      },{id: "books-the-godfather",
          title: 'The Godfather',
          description: "",
          section: "Books",handler: () => {
              window.location.href = "/books/the_godfather/";
            },},{id: "news-designweaver-got-into-chi-25-will-go-to-japan-sparkles-smile",
          title: 'DesignWeaver got into CHI 25! Will go to Japan! :sparkles: :smile:',
          description: "",
          section: "News",},{id: "news-hotspot-got-into-cvpr-25",
          title: 'HotSpot got into CVPR 25!',
          description: "",
          section: "News",},{id: "news-hotspot-got-selected-as-a-cvpr-25-highlight",
          title: 'HotSpot got selected as a CVPR 25 Highlight!',
          description: "",
          section: "News",},{id: "news-our-chi-2026-workshop-position-paper-what-happened-and-why-trace-guided-micro-episodes-with-elicited-user-explanations-for-product-iteration-was-accepted-to-herding-cats-easily-one-of-the-best-workshop-names-ever-the-whole-protolab-is-going-to-spain-might-be-a-ucsd-party-beer-cat-wine-glass",
          title: 'Our CHI 2026 workshop position paper, What Happened and Why? Trace-Guided Micro-Episodes with...',
          description: "",
          section: "News",},{id: "news-met-the-great-don-norman-and-even-got-a-selfie-a-to-sirui-signed-yellow-book-sparkles-camera-flash-smile",
          title: 'Met the great Don Norman and even got a selfie + a “To...',
          description: "",
          section: "News",},{id: "projects-designweaver",
          title: 'DesignWeaver',
          description: "A prompt-design workspace that surfaces visual dimensions so novices can make more deliberate product concepts.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/designweaver/";
            },},{id: "projects-hotspot",
          title: 'HotSpot',
          description: "A neural SDF optimization framework with a screened Poisson objective for more stable surface reconstruction.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/hotspot/";
            },},{id: "projects-physion",
          title: 'Physion',
          description: "A benchmark for testing whether vision models predict physical scene dynamics the way people do.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/physion/";
            },},{id: "projects-vibe-coding-a-research-portfolio",
          title: 'Vibe-Coding a Research Portfolio',
          description: "A reflective redesign of this website into a warmer, clearer research portfolio and a reusable design-heuristics guide for students.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/website-revamp/";
            },},{id: "projects-what-happened-and-why",
          title: 'What Happened and Why?',
          description: "A CHI 2026 workshop position paper about trace-guided micro-episodes and in-flow user explanations for product iteration in AI-supported design tools.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/what-happened-and-why/";
            },},{id: "teachings-data-science-fundamentals",
          title: 'Data Science Fundamentals',
          description: "This course covers the foundational aspects of data science, including data collection, cleaning, analysis, and visualization. Students will learn practical skills for working with real-world datasets.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/data-science-fundamentals/";
            },},{id: "teachings-introduction-to-machine-learning",
          title: 'Introduction to Machine Learning',
          description: "This course provides an introduction to machine learning concepts, algorithms, and applications. Students will learn about supervised and unsupervised learning, model evaluation, and practical implementations.",
          section: "Teachings",handler: () => {
              window.location.href = "/teachings/introduction-to-machine-learning/";
            },},{
        id: 'social-bluesky',
        title: 'Bluesky',
        section: 'Socials',
        handler: () => {
          window.open("https://siruitao.bsky.social", "_blank");
        },
      },{
        id: 'social-x',
        title: 'X',
        section: 'Socials',
        handler: () => {
          window.open("https://twitter.com/SiruiTao", "_blank");
        },
      },{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/assets/pdf/Sirui_Tao_CV_Public.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%64%79%6C%61%6E%74%61%6F%73%69%72%75%69@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/DylanTao", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/siruitao", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=W6vF-VcAAAAJ&hl", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
