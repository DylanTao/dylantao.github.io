const ninja = document.querySelector('ninja-keys');

ninja.data = [
  {
    id: "quick-research",
    title: "research overview",
    description: "Overview of Sirui Tao's research thesis, focus areas, projects, publications, and design judgment work.",
    section: "Start here",
    handler: () => {
      window.location.href = "/#taste";
    },
  },
  {
    id: "quick-thesis",
    title: "Research thesis: Scaffolding for Taste",
    description: "Sirui Tao research thesis taste design judgment human-centered AI generative AI value tradeoffs evidence.",
    section: "Start here",
    handler: () => {
      window.location.href = "/#taste";
    },
  },
  {
    id: "quick-focus",
    title: "Research focus: design, evaluate, situate",
    description: "Research directions design evaluation situated mixed reality embodied systems interfaces.",
    section: "Start here",
    handler: () => {
      window.location.href = "/#focus";
    },
  },
  {
    id: "quick-students",
    title: "Student research opportunities",
    description: "Prospective students interns undergraduate master's research opportunity UCSD ProtoLab apply email interest.",
    section: "Start here",
    handler: () => {
      window.location.href = "/#students";
    },
  },
  {
    id: "quick-student-post",
    title: "How to start doing research at UC San Diego",
    description: "Student intern undergraduate master's research-start post how to contact Sirui about research.",
    section: "Start here",
    handler: () => {
      window.location.href = "/blog/2026/how-to-start-doing-research-at-ucsd/";
    },
  },
  {
    id: "quick-contact",
    title: "Contact Sirui",
    description: "Email contact connect LinkedIn GitHub Bluesky X social profiles.",
    section: "Start here",
    handler: () => {
      window.location.href = "/#connect";
    },
  },
  {
    id: "quick-cv",
    title: "CV",
    description: "Curriculum vitae resume honors awards education publications experience references.",
    section: "Start here",
    handler: () => {
      window.location.href = "/cv/";
    },
  },
  {
    id: "quick-cv-pdf",
    title: "CV PDF",
    description: "Download Sirui Tao CV PDF curriculum vitae resume.",
    section: "Start here",
    handler: () => {
      window.open("/assets/pdf/Sirui_Tao_CV_Public.pdf", "_blank");
    },
  },
  {
    id: "quick-projects",
    title: "Projects",
    description: "DesignWeaver HotSpot Physion GraphHSCN Context-Aware Encoding project portfolio prototypes systems.",
    section: "Start here",
    handler: () => {
      window.location.href = "/projects/";
    },
  },
  {
    id: "quick-publications",
    title: "Publications",
    description: "Papers CHI UIST CSCW research publications bibliography.",
    section: "Start here",
    handler: () => {
      window.location.href = "/publications/";
    },
  },
  {
    id: "quick-updates",
    title: "Recent updates",
    description: "News announcements recent updates Sirui Tao.",
    section: "Start here",
    handler: () => {
      window.location.href = "/news/";
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
  },{id: "nav-publications",
          title: "publications",
          description: "Papers and workshop pieces, kept chronological.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "Research artifacts, prototypes, and studies that make research questions concrete: build the artifact, study the friction, and keep the figure readable enough that someone can inspect the claim.",
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
          
          description: "A short reflection on using Codex, screenshots, and design heuristics to redesign a research portfolio over two days.",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2026/website-redesign-ai-agent/";
            
          },
        },{id: "post-science-communication-is-kindness",
          
            title: "science communication is kindness",
          
          description: "A short reflection on why scientists should communicate publicly, and how to do it with care.",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2026/science-communication-is-kindness/";
            
          },
        },{id: "post-prototyping-to-understand-humans",
          
            title: "prototyping to understand humans",
          
          description: "Some working thoughts on good HCI research in the age of AI.",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2026/prototyping-to-understand-humans/";
            
          },
        },{id: "post-research-skills-starter-pack",
          
            title: "research skills starter pack",
          
          description: "An ongoing self-study list for learning research reading, writing, reviewing, Ph.D. life, and empirical methods.",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2026/research-skills-starter-pack/";
            
          },
        },{id: "post-how-to-start-doing-research-at-ucsd",
          
            title: "how to start doing research at ucsd",
          
          description: "A short note for prospective undergraduate and master&#39;s research interns at UC San Diego.",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2026/how-to-start-doing-research-at-ucsd/";
            
          },
        },{id: "post-an-afternoon-with-don-norman",
          
            title: "an afternoon with don norman",
          
          description: "Don gave a talk at DLab about his charity, signed my Yellow Book, and told us to check out his new book",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2026/don-norman-design-lab-talk/";
            
          },
        },{id: "post-starting-my-pottery-journey",
          
            title: "starting my pottery journey",
          
          description: "embarking on a pottery journey with ellen fager at ucsd craft center, featuring three commissioned works",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2025/starting-pottery/";
            
          },
        },{id: "post-a-gallery-of-random-gen-ai-images",
          
            title: "a gallery of random gen-ai images",
          
          description: "a gallery of random gen-ai images",
          section: "Writing",
          handler: () => {
            
              window.location.href = "/blog/2024/image-gallery/";
            
          },
        },{id: "project-what-happened-and-why",
        title: "What Happened and Why?",
        description: "A CHI 2026 workshop position paper about trace-guided micro-episodes and in-flow user explanations for product iteration in AI-supported design tools.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/what-happened-and-why/";
        },
      },{id: "project-hotspot",
        title: "HotSpot",
        description: "A neural SDF optimization framework with a screened Poisson objective for more stable surface reconstruction.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/hotspot/";
        },
      },{id: "project-designweaver",
        title: "DesignWeaver",
        description: "A prompt-design workspace that surfaces visual dimensions so novices can make more deliberate product concepts.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/designweaver/";
        },
      },{id: "project-physion",
        title: "Physion",
        description: "A benchmark for testing whether vision models predict physical scene dynamics the way people do.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/physion/";
        },
      },{id: "project-vibe-coding-a-research-portfolio",
        title: "Vibe-Coding a Research Portfolio",
        description: "A reflective redesign of this website into a warmer, clearer research portfolio and a reusable design-heuristics guide for students.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/website-revamp/";
        },
      },{id: "project-not-a-good-driver",
        title: "Not A Good Driver",
        description: "A playful VRChat world experiment in virtual-world creation, social audience engagement, and AI-assisted prototyping.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/not-a-good-driver/";
        },
      },{id: "project-context-aware-encoding-for-llms",
        title: "Context-Aware Encoding for LLMs",
        description: "A tree-of-thoughts context encoding experiment for improving retrieval and long-document contextual understanding.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/context-aware-encoding/";
        },
      },{id: "project-graphhscn",
        title: "GraphHSCN",
        description: "A graph neural network architecture prototype for modeling long-range interactions in structured data.",
        section: "Projects",
        handler: () => {
          window.location.href = "/projects/graphhscn/";
        },
      },{
      id: "contact-email",
      title: "Email Sirui",
      description: "Email contact Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.location.href = "mailto:dylantaosirui@gmail.com";
      },
    },{
      id: "contact-github",
      title: "GitHub",
      description: "Code repositories projects GitHub Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.open("https://github.com/DylanTao", "_blank");
      },
    },{
      id: "contact-linkedin",
      title: "LinkedIn",
      description: "Professional profile contact collaborator LinkedIn.",
      section: "Contact",
      handler: () => {
        window.open("https://www.linkedin.com/in/siruitao", "_blank");
      },
    },{
      id: "contact-scholar",
      title: "Google Scholar",
      description: "Scholar citations papers academic publications.",
      section: "Contact",
      handler: () => {
        window.open("https://scholar.google.com/citations?user=W6vF-VcAAAAJ&hl", "_blank");
      },
    },{
      id: "contact-bluesky",
      title: "Bluesky",
      description: "Social updates Bluesky Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.open("https://siruitao.bsky.social", "_blank");
      },
    },{
      id: "contact-x",
      title: "X / Twitter",
      description: "Social updates X Twitter Sirui Tao.",
      section: "Contact",
      handler: () => {
        window.open("https://x.com/SiruiTao", "_blank");
      },
    },];
