// Has to be in the head tag, otherwise a flicker effect will occur.

// Pause motion (the sun-arc panel): while it is on, matchMedia("(prefers-reduced-motion: reduce)")
// also matches and notifies its listeners, so every animated surface that already honors reduced
// motion (the 3D home, duh, P, the footer coast, the research sketch, cinematic scenes) stills
// through that same path without its own switch. CSS-only motion keys off html[data-motion].
// It installs here, in the head, before any module asks.
const siteMotionStorageKey = "site-motion";
const siteMotion = (() => {
  const reducedQuery = /\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i;
  const nativeMatchMedia = window.matchMedia.bind(window);
  // Lists with change listeners, so a pause can reach them.
  const watched = new Set();
  let paused = false;
  try {
    paused = localStorage.getItem(siteMotionStorageKey) === "paused";
  } catch {
    // Storage can be blocked; motion then simply runs.
  }
  const mark = () => {
    if (paused) document.documentElement.setAttribute("data-motion", "paused");
    else document.documentElement.removeAttribute("data-motion");
  };
  mark();
  // Each call keeps its own native list and that list's own change events, exactly as without the
  // switch; the pause is only laid over what it reports. A first version shared one native list
  // among every caller, and P's playground then intermittently never heard reduced motion end.
  window.matchMedia = (media) => {
    const list = nativeMatchMedia(media);
    if (!reducedQuery.test(media)) return list;
    const listeners = new Set();
    let onchange = null,
      connected = false;
    const deliver = (matches) => {
      const event = { type: "change", matches, media: list.media };
      // As with a native list, one listener's error must not keep the rest from hearing.
      for (const listener of [...listeners, onchange]) {
        if (!listener) continue;
        try {
          if (typeof listener === "function") listener.call(view, event);
          else listener.handleEvent?.(event);
        } catch (error) {
          setTimeout(() => {
            throw error;
          });
        }
      }
    };
    // Pausing or resuming changes what this list reports only while the system setting is off.
    const entry = { pauseChanged: () => list.matches || deliver(paused) };
    const connect = () => {
      if (connected) return;
      connected = true;
      list.addEventListener("change", (event) => paused || deliver(event.matches));
      watched.add(entry);
    };
    const view = {
      get media() {
        return list.media;
      },
      get matches() {
        return list.matches || paused;
      },
      get onchange() {
        return onchange;
      },
      set onchange(handler) {
        onchange = handler;
        if (handler) connect();
      },
      addEventListener(type, listener) {
        if (type !== "change" || !listener) return;
        listeners.add(listener);
        connect();
      },
      removeEventListener(type, listener) {
        if (type === "change") listeners.delete(listener);
      },
      addListener(listener) {
        if (!listener) return;
        listeners.add(listener);
        connect();
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
      dispatchEvent() {
        return true;
      },
    };
    return view;
  };
  const api = {
    get paused() {
      return paused;
    },
    setPaused(next) {
      if (Boolean(next) === paused) return;
      paused = Boolean(next);
      try {
        if (paused) localStorage.setItem(siteMotionStorageKey, "paused");
        else localStorage.removeItem(siteMotionStorageKey);
      } catch {
        // The choice still holds for this page.
      }
      mark();
      watched.forEach((entry) => entry.pauseChanged());
      window.dispatchEvent(new CustomEvent("siteMotionChange", { detail: { paused } }));
    },
  };
  window.siteMotion = api;
  return api;
})();

const themeModes = ["morning", "noon", "afternoon", "evening"];
const themeStorageKey = "theme";
const themeManualStorageKey = "theme-manual";
let themeBoundaryTimer = null;
const themeModeMeta = {
  morning: { label: "Morning", computedTheme: "light" },
  noon: { label: "Noon", computedTheme: "light" },
  afternoon: { label: "Afternoon", computedTheme: "light" },
  evening: { label: "Evening", computedTheme: "dark" },
};

// The time of day follows La Jolla's sun, the one clock the sun arc, the footer coast and the 3D home
// also keep: evening begins when the sun sinks 3 degrees below the horizon, as light ink comes to read
// as well as dark on the coast behind the footer's credit, and morning at the same depth before sunrise;
// noon is the four hours around solar noon. The visitor's clock and date read as La Jolla's. This is
// an exact copy of assets/js/la-jolla-sun.mjs's themeDay for the head, before any module loads;
// test/la-jolla-sun.test.mjs holds the two equal.
// la-jolla-sun:begin
const laJollaThemeDay = (() => {
  const RAD = Math.PI / 180;
  const latitude = 32.83 * RAD;
  const longitude = -117.27;
  const days = new Map();
  const usPacificOffset = (year, month, day) => {
    const sunday = (m, nth) => 1 + ((7 - new Date(Date.UTC(year, m - 1, 1)).getUTCDay()) % 7) + 7 * (nth - 1);
    const t = month * 100 + day;
    return t >= 300 + sunday(3, 2) && t < 1100 + sunday(11, 1) ? -7 : -8;
  };
  const pacificOffset = (year, month, day) => {
    let offset = usPacificOffset(year, month, day);
    try {
      const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "longOffset" })
        .formatToParts(new Date(Date.UTC(year, month - 1, day, 20)))
        .find((part) => part.type === "timeZoneName").value;
      const match = zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) offset = (match[1] === "-" ? -1 : 1) * (Number(match[2]) + Number(match[3] || 0) / 60);
    } catch {
      // The rule above stands in.
    }
    return offset;
  };
  const orbit = (year, month, day, minute) => {
    const dayOfYear = (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000;
    const length = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    const gamma = ((Math.PI * 2) / length) * (dayOfYear - 1 + (minute / 60 - 12) / 24);
    const equation =
      229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const declination =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma);
    return { equation, declination };
  };
  return (date = new Date()) => {
    const year = date.getFullYear(),
      month = date.getMonth() + 1,
      day = date.getDate();
    const key = year * 10000 + month * 100 + day;
    if (days.has(key)) return days.get(key);
    const offset = pacificOffset(year, month, day);
    const altitude = (minute) => {
      const { equation, declination } = orbit(year, month, day, minute);
      const hourAngle = ((minute + equation + 4 * longitude - 60 * offset) / 4 - 180) * RAD;
      const cosZenith = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
      return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / RAD;
    };
    const crossing = (target, from, to) => {
      let lo = from,
        hi = to;
      const rising = altitude(hi) > altitude(lo);
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (altitude(mid) > target === rising) hi = mid;
        else lo = mid;
      }
      return (lo + hi) / 2;
    };
    const noon = 720 - 4 * longitude - orbit(year, month, day, 720).equation + 60 * offset;
    const result = { start: crossing(-3, noon - 720, noon), noonStart: noon - 120, noon, noonEnd: noon + 120, end: crossing(-3, noon, noon + 720) };
    days.set(key, result);
    return result;
  };
})();
// la-jolla-sun:end

// Cycle through time-of-day modes when a compact trigger is used without opening the menu.
let toggleThemeSetting = () => {
  const themeSetting = determineThemeSetting();
  const index = themeModes.indexOf(themeSetting);
  setThemeSetting(themeModes[(index + 1) % themeModes.length]);
};

// Change the theme setting and apply the compatible light/dark theme.
let setThemeSetting = (themeSetting, options = { persist: true, manual: true }) => {
  const nextThemeSetting = normalizeThemeSetting(themeSetting);

  if (options.persist) {
    writeSessionThemeSetting(nextThemeSetting, options.manual !== false);
  }

  document.documentElement.setAttribute("data-theme-setting", nextThemeSetting);
  document.documentElement.setAttribute("data-theme-mode", nextThemeSetting);

  applyTheme();
  scheduleAutomaticThemeCheck();
};

// Apply the computed dark or light theme to integrations while preserving the richer mode.
let applyTheme = () => {
  let themeSetting = determineThemeSetting();
  let theme = determineComputedTheme(themeSetting);

  document.documentElement.setAttribute("data-theme-setting", themeSetting);
  document.documentElement.setAttribute("data-theme-mode", themeSetting);
  document.documentElement.setAttribute("data-theme", theme);

  transTheme();
  setHighlight(theme);
  setGiscusTheme(theme);
  setSearchTheme(theme);
  setCookieConsentTheme(theme);
  updateCalendarUrl();

  // if mermaid is not defined, do nothing
  if (typeof mermaid !== "undefined") {
    setMermaidTheme(theme);
  }

  // if diff2html is not defined, do nothing
  if (typeof Diff2HtmlUI !== "undefined") {
    setDiff2htmlTheme(theme);
  }

  // if echarts is not defined, do nothing
  if (typeof echarts !== "undefined") {
    setEchartsTheme(theme);
  }

  // if Plotly is not defined, do nothing
  if (typeof Plotly !== "undefined") {
    setPlotlyTheme(theme);
  }

  // if vegaEmbed is not defined, do nothing
  if (typeof vegaEmbed !== "undefined") {
    setVegaLiteTheme(theme);
  }

  updateThemeToggleUI(themeSetting);
  window.dispatchEvent(new CustomEvent("siteThemeChange", { detail: { theme: theme, themeMode: themeSetting } }));

  // Add class to tables.
  let tables = document.getElementsByTagName("table");
  for (let i = 0; i < tables.length; i++) {
    if (theme == "dark") {
      tables[i].classList.add("table-dark");
    } else {
      tables[i].classList.remove("table-dark");
    }
  }

  // Set jupyter notebooks themes.
  let jupyterNotebooks = document.getElementsByClassName("jupyter-notebook-iframe-container");
  for (let i = 0; i < jupyterNotebooks.length; i++) {
    let bodyElement = jupyterNotebooks[i].getElementsByTagName("iframe")[0].contentWindow.document.body;
    if (theme == "dark") {
      bodyElement.setAttribute("data-jp-theme-light", "false");
      bodyElement.setAttribute("data-jp-theme-name", "JupyterLab Dark");
    } else {
      bodyElement.setAttribute("data-jp-theme-light", "true");
      bodyElement.setAttribute("data-jp-theme-name", "JupyterLab Light");
    }
  }

  // Updates the background of medium-zoom overlay.
  if (typeof medium_zoom !== "undefined") {
    medium_zoom.update({
      background: getComputedStyle(document.documentElement).getPropertyValue("--global-bg-color") + "ee", // + 'ee' for trasparency.
    });
  }
};

let setHighlight = (theme) => {
  if (theme == "dark") {
    document.getElementById("highlight_theme_light").media = "none";
    document.getElementById("highlight_theme_dark").media = "";
  } else {
    document.getElementById("highlight_theme_dark").media = "none";
    document.getElementById("highlight_theme_light").media = "";
  }
};

let setGiscusTheme = (theme) => {
  function sendMessage(message) {
    const iframe = document.querySelector("iframe.giscus-frame");
    if (!iframe) return;
    iframe.contentWindow.postMessage({ giscus: message }, "https://giscus.app");
  }

  sendMessage({
    setConfig: {
      theme: theme,
    },
  });
};

let addMermaidZoom = (records, observer) => {
  var svgs = d3.selectAll(".mermaid svg");
  svgs.each(function () {
    var svg = d3.select(this);
    svg.html("<g>" + svg.html() + "</g>");
    var inner = svg.select("g");
    var zoom = d3.zoom().on("zoom", function (event) {
      inner.attr("transform", event.transform);
    });
    svg.call(zoom);
  });
  observer.disconnect();
};

let setMermaidTheme = (theme) => {
  if (theme == "light") {
    // light theme name in mermaid is 'default'
    // https://mermaid.js.org/config/theming.html#available-themes
    theme = "default";
  }

  /* Re-render the SVG, based on https://github.com/cotes2020/jekyll-theme-chirpy/blob/master/_includes/mermaid.html */
  document.querySelectorAll(".mermaid").forEach((elem) => {
    // Get the code block content from previous element, since it is the mermaid code itself as defined in Markdown, but it is hidden
    let svgCode = elem.previousSibling.childNodes[0].innerHTML;
    elem.removeAttribute("data-processed");
    elem.innerHTML = svgCode;
  });

  mermaid.initialize({ theme: theme });
  window.mermaid.init(undefined, document.querySelectorAll(".mermaid"));

  const observable = document.querySelector(".mermaid svg");
  if (observable !== null) {
    var observer = new MutationObserver(addMermaidZoom);
    const observerOptions = { childList: true };
    observer.observe(observable, observerOptions);
  }
};

let setDiff2htmlTheme = (theme) => {
  document.querySelectorAll(".diff2html").forEach((elem) => {
    // Get the code block content from previous element, since it is the diff code itself as defined in Markdown, but it is hidden
    let textData = elem.previousSibling.childNodes[0].innerHTML;
    elem.innerHTML = "";
    const configuration = { colorScheme: theme, drawFileList: true, highlight: true, matching: "lines" };
    const diff2htmlUi = new Diff2HtmlUI(elem, textData, configuration);
    diff2htmlUi.draw();
  });
};

let setEchartsTheme = (theme) => {
  document.querySelectorAll(".echarts").forEach((elem) => {
    // Get the code block content from previous element, since it is the echarts code itself as defined in Markdown, but it is hidden
    let jsonData = elem.previousSibling.childNodes[0].innerHTML;
    echarts.dispose(elem);

    if (theme === "dark") {
      var chart = echarts.init(elem, "dark-fresh-cut");
    } else {
      var chart = echarts.init(elem);
    }

    chart.setOption(JSON.parse(jsonData));
  });
};

let setPlotlyTheme = (theme) => {
  document.querySelectorAll(".js-plotly-plot").forEach((elem) => {
    // Get the code block content from previous element, since it is the plotly code itself as defined in Markdown, but it is hidden
    let jsonData = JSON.parse(elem.previousSibling.childNodes[0].innerHTML);

    if (theme === "dark") {
      // dark theme extracted from https://github.com/plotly/plotly.py/blob/main/plotly/package_data/templates/plotly_dark.json?raw=true
      // prettier-ignore
      const plotlyDarkLayout = {"layout":{"autotypenumbers":"strict","colorway":["#636efa","#EF553B","#00cc96","#ab63fa","#FFA15A","#19d3f3","#FF6692","#B6E880","#FF97FF","#FECB52"],"font":{"color":"#f2f5fa"},"hovermode":"closest","hoverlabel":{"align":"left"},"paper_bgcolor":"rgb(17,17,17)","plot_bgcolor":"rgb(17,17,17)","polar":{"bgcolor":"rgb(17,17,17)","angularaxis":{"gridcolor":"#506784","linecolor":"#506784","ticks":""},"radialaxis":{"gridcolor":"#506784","linecolor":"#506784","ticks":""}},"ternary":{"bgcolor":"rgb(17,17,17)","aaxis":{"gridcolor":"#506784","linecolor":"#506784","ticks":""},"baxis":{"gridcolor":"#506784","linecolor":"#506784","ticks":""},"caxis":{"gridcolor":"#506784","linecolor":"#506784","ticks":""}},"coloraxis":{"colorbar":{"outlinewidth":0,"ticks":""}},"colorscale":{"sequential":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"sequentialminus":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"diverging":[[0,"#8e0152"],[0.1,"#c51b7d"],[0.2,"#de77ae"],[0.3,"#f1b6da"],[0.4,"#fde0ef"],[0.5,"#f7f7f7"],[0.6,"#e6f5d0"],[0.7,"#b8e186"],[0.8,"#7fbc41"],[0.9,"#4d9221"],[1,"#276419"]]},"xaxis":{"gridcolor":"#283442","linecolor":"#506784","ticks":"","title":{"standoff":15},"zerolinecolor":"#283442","automargin":true,"zerolinewidth":2},"yaxis":{"gridcolor":"#283442","linecolor":"#506784","ticks":"","title":{"standoff":15},"zerolinecolor":"#283442","automargin":true,"zerolinewidth":2},"scene":{"xaxis":{"backgroundcolor":"rgb(17,17,17)","gridcolor":"#506784","linecolor":"#506784","showbackground":true,"ticks":"","zerolinecolor":"#C8D4E3","gridwidth":2},"yaxis":{"backgroundcolor":"rgb(17,17,17)","gridcolor":"#506784","linecolor":"#506784","showbackground":true,"ticks":"","zerolinecolor":"#C8D4E3","gridwidth":2},"zaxis":{"backgroundcolor":"rgb(17,17,17)","gridcolor":"#506784","linecolor":"#506784","showbackground":true,"ticks":"","zerolinecolor":"#C8D4E3","gridwidth":2}},"shapedefaults":{"line":{"color":"#f2f5fa"}},"annotationdefaults":{"arrowcolor":"#f2f5fa","arrowhead":0,"arrowwidth":1},"geo":{"bgcolor":"rgb(17,17,17)","landcolor":"rgb(17,17,17)","subunitcolor":"#506784","showland":true,"showlakes":true,"lakecolor":"rgb(17,17,17)"},"title":{"x":0.05},"updatemenudefaults":{"bgcolor":"#506784","borderwidth":0},"sliderdefaults":{"bgcolor":"#C8D4E3","borderwidth":1,"bordercolor":"rgb(17,17,17)","tickwidth":0},"mapbox":{"style":"dark"}},"data":{"histogram2dcontour":[{"type":"histogram2dcontour","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"choropleth":[{"type":"choropleth","colorbar":{"outlinewidth":0,"ticks":""}}],"histogram2d":[{"type":"histogram2d","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"heatmap":[{"type":"heatmap","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contourcarpet":[{"type":"contourcarpet","colorbar":{"outlinewidth":0,"ticks":""}}],"contour":[{"type":"contour","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"surface":[{"type":"surface","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"mesh3d":[{"type":"mesh3d","colorbar":{"outlinewidth":0,"ticks":""}}],"scatter":[{"marker":{"line":{"color":"#283442"}},"type":"scatter"}],"parcoords":[{"type":"parcoords","line":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scatterpolargl":[{"type":"scatterpolargl","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"bar":[{"error_x":{"color":"#f2f5fa"},"error_y":{"color":"#f2f5fa"},"marker":{"line":{"color":"rgb(17,17,17)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"type":"bar"}],"scattergeo":[{"type":"scattergeo","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scatterpolar":[{"type":"scatterpolar","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"histogram":[{"marker":{"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"type":"histogram"}],"scattergl":[{"marker":{"line":{"color":"#283442"}},"type":"scattergl"}],"scatter3d":[{"type":"scatter3d","line":{"colorbar":{"outlinewidth":0,"ticks":""}},"marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scattermap":[{"type":"scattermap","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scattermapbox":[{"type":"scattermapbox","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scatterternary":[{"type":"scatterternary","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scattercarpet":[{"type":"scattercarpet","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"carpet":[{"aaxis":{"endlinecolor":"#A2B1C6","gridcolor":"#506784","linecolor":"#506784","minorgridcolor":"#506784","startlinecolor":"#A2B1C6"},"baxis":{"endlinecolor":"#A2B1C6","gridcolor":"#506784","linecolor":"#506784","minorgridcolor":"#506784","startlinecolor":"#A2B1C6"},"type":"carpet"}],"table":[{"cells":{"fill":{"color":"#506784"},"line":{"color":"rgb(17,17,17)"}},"header":{"fill":{"color":"#2a3f5f"},"line":{"color":"rgb(17,17,17)"}},"type":"table"}],"barpolar":[{"marker":{"line":{"color":"rgb(17,17,17)","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"type":"barpolar"}],"pie":[{"automargin":true,"type":"pie"}]}};

      // if jsonData.layout exists, then update the theme
      if (jsonData.layout) {
        if (jsonData.layout.template) {
          jsonData.layout.template = { ...plotlyDarkLayout, ...jsonData.layout.template };
        } else {
          jsonData.layout.template = plotlyDarkLayout;
        }
      } else {
        jsonData.layout = { template: plotlyDarkLayout };
      }
    } else {
      // light theme extracted from https://github.com/plotly/plotly.py/blob/main/plotly/package_data/templates/plotly_white.json?raw=true
      // prettier-ignore
      const plotlyLightLayout = {"layout":{"autotypenumbers":"strict","colorway":["#636efa","#EF553B","#00cc96","#ab63fa","#FFA15A","#19d3f3","#FF6692","#B6E880","#FF97FF","#FECB52"],"font":{"color":"#2a3f5f"},"hovermode":"closest","hoverlabel":{"align":"left"},"paper_bgcolor":"white","plot_bgcolor":"white","polar":{"bgcolor":"white","angularaxis":{"gridcolor":"#EBF0F8","linecolor":"#EBF0F8","ticks":""},"radialaxis":{"gridcolor":"#EBF0F8","linecolor":"#EBF0F8","ticks":""}},"ternary":{"bgcolor":"white","aaxis":{"gridcolor":"#DFE8F3","linecolor":"#A2B1C6","ticks":""},"baxis":{"gridcolor":"#DFE8F3","linecolor":"#A2B1C6","ticks":""},"caxis":{"gridcolor":"#DFE8F3","linecolor":"#A2B1C6","ticks":""}},"coloraxis":{"colorbar":{"outlinewidth":0,"ticks":""}},"colorscale":{"sequential":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"sequentialminus":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]],"diverging":[[0,"#8e0152"],[0.1,"#c51b7d"],[0.2,"#de77ae"],[0.3,"#f1b6da"],[0.4,"#fde0ef"],[0.5,"#f7f7f7"],[0.6,"#e6f5d0"],[0.7,"#b8e186"],[0.8,"#7fbc41"],[0.9,"#4d9221"],[1,"#276419"]]},"xaxis":{"gridcolor":"#EBF0F8","linecolor":"#EBF0F8","ticks":"","title":{"standoff":15},"zerolinecolor":"#EBF0F8","automargin":true,"zerolinewidth":2},"yaxis":{"gridcolor":"#EBF0F8","linecolor":"#EBF0F8","ticks":"","title":{"standoff":15},"zerolinecolor":"#EBF0F8","automargin":true,"zerolinewidth":2},"scene":{"xaxis":{"backgroundcolor":"white","gridcolor":"#DFE8F3","linecolor":"#EBF0F8","showbackground":true,"ticks":"","zerolinecolor":"#EBF0F8","gridwidth":2},"yaxis":{"backgroundcolor":"white","gridcolor":"#DFE8F3","linecolor":"#EBF0F8","showbackground":true,"ticks":"","zerolinecolor":"#EBF0F8","gridwidth":2},"zaxis":{"backgroundcolor":"white","gridcolor":"#DFE8F3","linecolor":"#EBF0F8","showbackground":true,"ticks":"","zerolinecolor":"#EBF0F8","gridwidth":2}},"shapedefaults":{"line":{"color":"#2a3f5f"}},"annotationdefaults":{"arrowcolor":"#2a3f5f","arrowhead":0,"arrowwidth":1},"geo":{"bgcolor":"white","landcolor":"white","subunitcolor":"#C8D4E3","showland":true,"showlakes":true,"lakecolor":"white"},"title":{"x":0.05},"mapbox":{"style":"light"}},"data":{"histogram2dcontour":[{"type":"histogram2dcontour","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"choropleth":[{"type":"choropleth","colorbar":{"outlinewidth":0,"ticks":""}}],"histogram2d":[{"type":"histogram2d","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"heatmap":[{"type":"heatmap","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"contourcarpet":[{"type":"contourcarpet","colorbar":{"outlinewidth":0,"ticks":""}}],"contour":[{"type":"contour","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"surface":[{"type":"surface","colorbar":{"outlinewidth":0,"ticks":""},"colorscale":[[0.0,"#0d0887"],[0.1111111111111111,"#46039f"],[0.2222222222222222,"#7201a8"],[0.3333333333333333,"#9c179e"],[0.4444444444444444,"#bd3786"],[0.5555555555555556,"#d8576b"],[0.6666666666666666,"#ed7953"],[0.7777777777777778,"#fb9f3a"],[0.8888888888888888,"#fdca26"],[1.0,"#f0f921"]]}],"mesh3d":[{"type":"mesh3d","colorbar":{"outlinewidth":0,"ticks":""}}],"scatter":[{"fillpattern":{"fillmode":"overlay","size":10,"solidity":0.2},"type":"scatter"}],"parcoords":[{"type":"parcoords","line":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scatterpolargl":[{"type":"scatterpolargl","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"bar":[{"error_x":{"color":"#2a3f5f"},"error_y":{"color":"#2a3f5f"},"marker":{"line":{"color":"white","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"type":"bar"}],"scattergeo":[{"type":"scattergeo","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scatterpolar":[{"type":"scatterpolar","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"histogram":[{"marker":{"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"type":"histogram"}],"scattergl":[{"type":"scattergl","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scatter3d":[{"type":"scatter3d","line":{"colorbar":{"outlinewidth":0,"ticks":""}},"marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scattermap":[{"type":"scattermap","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scattermapbox":[{"type":"scattermapbox","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scatterternary":[{"type":"scatterternary","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"scattercarpet":[{"type":"scattercarpet","marker":{"colorbar":{"outlinewidth":0,"ticks":""}}}],"carpet":[{"aaxis":{"endlinecolor":"#2a3f5f","gridcolor":"#C8D4E3","linecolor":"#C8D4E3","minorgridcolor":"#C8D4E3","startlinecolor":"#2a3f5f"},"baxis":{"endlinecolor":"#2a3f5f","gridcolor":"#C8D4E3","linecolor":"#C8D4E3","minorgridcolor":"#C8D4E3","startlinecolor":"#2a3f5f"},"type":"carpet"}],"table":[{"cells":{"fill":{"color":"#EBF0F8"},"line":{"color":"white"}},"header":{"fill":{"color":"#C8D4E3"},"line":{"color":"white"}},"type":"table"}],"barpolar":[{"marker":{"line":{"color":"white","width":0.5},"pattern":{"fillmode":"overlay","size":10,"solidity":0.2}},"type":"barpolar"}],"pie":[{"automargin":true,"type":"pie"}]}};

      // if jsonData.layout exists, then update the theme
      if (jsonData.layout) {
        if (jsonData.layout.template) {
          jsonData.layout.template = { ...plotlyLightLayout, ...jsonData.layout.template };
        } else {
          jsonData.layout.template = plotlyLightLayout;
        }
      } else {
        jsonData.layout = { template: plotlyLightLayout };
      }
    }

    Plotly.relayout(elem, jsonData.layout);
  });
};

let setVegaLiteTheme = (theme) => {
  document.querySelectorAll(".vega-lite").forEach((elem) => {
    // Get the code block content from previous element, since it is the vega lite code itself as defined in Markdown, but it is hidden
    let jsonData = elem.previousSibling.childNodes[0].innerHTML;
    elem.innerHTML = "";
    if (theme === "dark") {
      vegaEmbed(elem, JSON.parse(jsonData), { theme: "dark" });
    } else {
      vegaEmbed(elem, JSON.parse(jsonData));
    }
  });
};

let setSearchTheme = (theme) => {
  const ninjaKeys = document.querySelector("ninja-keys");
  if (!ninjaKeys) return;

  if (theme === "dark") {
    ninjaKeys.classList.add("dark");
  } else {
    ninjaKeys.classList.remove("dark");
  }
};

let setCookieConsentTheme = (theme) => {
  // Sync cookie consent modal with site's theme
  // The cookie consent library supports dark mode via the cc--darkmode class
  var htmlElement = document.documentElement;

  if (theme === "dark") {
    htmlElement.classList.add("cc--darkmode");
  } else {
    htmlElement.classList.remove("cc--darkmode");
  }
};

let transTheme = () => {
  // A pick revealed as one view transition needs no per-property color transition on top.
  if (themeRevealActive) return;
  document.documentElement.classList.add("transition");
  window.setTimeout(() => {
    document.documentElement.classList.remove("transition");
  }, 500);
};

// A time-of-day pick spreads from the option that was chosen: the new light grows out of it in a
// soft water edge on the site's gentle spring (site-motion.mjs), as one view transition, so gradients
// and canvases change together with everything else. Dragging the sun arc and the automatic clock
// keep the brief color transition; reduced motion swaps at once, and automation keeps the instant
// change its captures rely on unless the URL asks for ?cinematic=live.
let themeRevealActive = false;
let themeTransition = null;
let themeRevealRevision = 0;
let revealThemeFrom = (origin, update) => {
  const root = document.documentElement;
  const revision = ++themeRevealRevision;
  themeTransition?.skipTransition();
  themeTransition = null;
  root.classList.remove("theme-revealing", "theme-water-revealing");
  const live = /[?&]cinematic=live(?:&|$)/.test(window.location.search);
  if (!origin || !document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator.webdriver && !live)) {
    update();
    return;
  }
  const box = origin.getBoundingClientRect();
  root.style.setProperty("--theme-reveal-x", `${Math.round(box.left + box.width / 2)}px`);
  root.style.setProperty("--theme-reveal-y", `${Math.round(box.top + box.height / 2)}px`);
  root.classList.add("theme-revealing");
  const done = () => {
    if (revision !== themeRevealRevision) return;
    themeTransition = null;
    root.classList.remove("theme-revealing", "theme-water-revealing");
  };
  try {
    const transition = document.startViewTransition(() => {
      if (revision !== themeRevealRevision) return;
      themeRevealActive = true;
      try {
        update();
      } finally {
        themeRevealActive = false;
      }
    });
    themeTransition = transition;
    transition.ready
      .then(() => {
        if (revision !== themeRevealRevision || !window.SiteMotion?.waterReveal) return; // The CSS circle remains a complete fallback.
        const animation = window.SiteMotion.waterReveal({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
        if (!animation) return;
        root.classList.add("theme-water-revealing");
        animation.finished.catch(() => {});
      })
      .catch(() => {}); // An interrupted reveal still commits its theme.
    transition.finished.then(done, done);
  } catch {
    done();
    update();
  }
};

window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  if (event.matches) themeTransition?.skipTransition();
});

let normalizeThemeSetting = (themeSetting) => {
  if (themeModes.includes(themeSetting)) return themeSetting;
  if (themeSetting === "dark") return "evening";
  if (themeSetting === "light") return "noon";
  return determineDefaultThemeMode();
};

// The mode for the clock's minute (the sun arc's own whole minutes) on La Jolla's sun.
let determineDefaultThemeMode = (date = new Date()) => {
  const day = laJollaThemeDay(date);
  const minute = date.getHours() * 60 + date.getMinutes();
  if (minute < day.start || minute >= day.end) return "evening";
  if (minute < day.noonStart) return "morning";
  if (minute < day.noonEnd) return "noon";
  return "afternoon";
};

let readSessionThemeSetting = () => {
  try {
    return sessionStorage.getItem(themeStorageKey);
  } catch {
    return null;
  }
};

let hasManualThemeSetting = () => {
  try {
    return sessionStorage.getItem(themeManualStorageKey) === "true" && themeModes.includes(sessionStorage.getItem(themeStorageKey));
  } catch {
    return false;
  }
};

let writeSessionThemeSetting = (themeSetting, manual = true) => {
  try {
    sessionStorage.setItem(themeStorageKey, themeSetting);
    if (manual) {
      sessionStorage.setItem(themeManualStorageKey, "true");
    }
  } catch {
    // Some privacy modes can block storage; local time fallback still works.
  }
};

let readLegacyThemeSetting = () => {
  try {
    const legacy = localStorage.getItem(themeStorageKey);
    if (legacy) {
      localStorage.removeItem(themeStorageKey);
      writeSessionThemeSetting(legacy, true);
    }
    return legacy;
  } catch {
    return null;
  }
};

// Determine the expected theme mode for this browser session.
let determineThemeSetting = () => {
  return normalizeThemeSetting(readSessionThemeSetting() || readLegacyThemeSetting());
};

// The next whole minute the mode turns: today's next boundary, or tomorrow's morning.
let msUntilNextThemeBoundary = () => {
  const now = new Date();
  const next = new Date(now);
  const day = laJollaThemeDay(now);
  const minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
  const boundary = [day.start, day.noonStart, day.noonEnd, day.end].map(Math.ceil).find((value) => value > minute);
  next.setHours(0, 0, 0, 0);
  if (boundary === undefined) {
    next.setDate(next.getDate() + 1);
    next.setMinutes(Math.ceil(laJollaThemeDay(next).start));
  } else {
    next.setMinutes(boundary);
  }
  return Math.max(1000, next.getTime() - now.getTime() + 1000);
};

let applyAutomaticThemeIfNeeded = () => {
  if (hasManualThemeSetting()) return;
  const nextMode = determineDefaultThemeMode();
  if (document.documentElement.getAttribute("data-theme-mode") !== nextMode) {
    setThemeSetting(nextMode, { persist: false, manual: false });
  }
};

let scheduleAutomaticThemeCheck = () => {
  window.clearTimeout(themeBoundaryTimer);
  themeBoundaryTimer = window.setTimeout(
    () => {
      applyAutomaticThemeIfNeeded();
      scheduleAutomaticThemeCheck();
    },
    Math.min(msUntilNextThemeBoundary(), 2147483647)
  );
};

// Determine the compatible theme, which can be "dark" or "light".
let determineComputedTheme = (themeSetting = determineThemeSetting()) => {
  return themeModeMeta[normalizeThemeSetting(themeSetting)].computedTheme;
};

let updateThemeToggleUI = (themeSetting = determineThemeSetting()) => {
  const controls = Array.from(document.querySelectorAll("[data-theme-control]"));
  const options = Array.from(document.querySelectorAll("[data-theme-mode-option]"));
  const mode = normalizeThemeSetting(themeSetting);
  const meta = themeModeMeta[mode];

  controls.forEach((control) => {
    const toggle = control.querySelector("[data-theme-toggle]");
    const icon = control.querySelector("[data-theme-icon]");
    const label = control.querySelector("[data-theme-label]");

    if (!toggle) return;

    toggle.setAttribute("aria-label", `Change theme. Current theme: ${meta.label}`);
    toggle.setAttribute("title", `Theme: ${meta.label}`);

    if (icon) {
      // The menu's options carry the time-of-day icons (_includes/theme_mode_icon.liquid).
      const optionIcon = control.querySelector(`[data-theme-mode-option="${mode}"] .theme-mode-icon`);
      if (optionIcon) icon.replaceChildren(optionIcon.cloneNode(true));
    }

    if (label) {
      label.textContent = `${meta.label} theme`;
    }
  });

  options.forEach((option) => {
    const isSelected = option.getAttribute("data-theme-mode-option") === mode;
    option.classList.toggle("is-active", isSelected);
    option.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
};

let setupThemeModeControl = () => {
  const controls = Array.from(document.querySelectorAll("[data-theme-control]"));

  if (controls.length === 0) return;

  const closeControl = (control) => {
    const toggle = control.querySelector("[data-theme-toggle]");
    const menu = control.querySelector("[data-theme-menu]");
    if (!toggle || !menu) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  };

  const closeOtherControls = (activeControl) => {
    controls.forEach((control) => {
      if (control !== activeControl) closeControl(control);
    });
  };

  const openControl = (control, options) => {
    const toggle = control.querySelector("[data-theme-toggle]");
    const menu = control.querySelector("[data-theme-menu]");
    if (!toggle || !menu) return;

    closeOtherControls(control);
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    // The sun-arc knob takes focus first, so arrow keys move the time of day at once.
    const knob = menu.querySelector("[data-sun-knob]");
    const selected = options.find((option) => option.getAttribute("aria-selected") === "true") || options[0];
    (knob || selected)?.focus();
  };

  controls.forEach((control) => {
    const toggle = control.querySelector("[data-theme-toggle]");
    const menu = control.querySelector("[data-theme-menu]");
    const options = Array.from(control.querySelectorAll("[data-theme-mode-option]"));

    if (!toggle || !menu || options.length === 0) return;

    toggle.addEventListener("click", () => {
      if (menu.hidden) {
        openControl(control, options);
      } else {
        closeControl(control);
      }
    });

    options.forEach((option, index) => {
      option.addEventListener("click", () => {
        revealThemeFrom(option, () => setThemeSetting(option.getAttribute("data-theme-mode-option")));
        // Keep the clock open for comparisons; Escape, the toggle and an outside tap dismiss it.
        option.focus({ preventScroll: true });
      });

      option.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeControl(control);
          toggle.focus();
        }

        if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
          const target = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + direction + options.length) % options.length;
          options[target].focus();
        }
      });
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeControl(control);
      toggle.focus();
    });

    document.addEventListener("click", (event) => {
      if (menu.hidden || control.contains(event.target)) return;
      closeControl(control);
    });
  });

  updateThemeToggleUI();
};

let initTheme = () => {
  setThemeSetting(determineThemeSetting(), { persist: false, manual: false });
  scheduleAutomaticThemeCheck();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      applyAutomaticThemeIfNeeded();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    setupThemeModeControl();
  });
};

// Get the appropriate background color for Google Calendar based on current theme
let getCalendarBgColor = () => {
  let theme = determineComputedTheme();
  return theme === "dark" ? "333333" : "f9f9f9";
};

// Get the Google Calendar embed URL with the correct background color
let getCalendarUrl = (calendarId, timezone = "UTC") => {
  const baseUrl = "https://calendar.google.com/calendar/embed";
  const params = new URLSearchParams({
    src: calendarId,
    ctz: timezone,
    mode: "WEEK",
    showTitle: "0",
    showPrint: "0",
    showCalendars: "0",
    showTabs: "0",
    bgcolor: getCalendarBgColor(),
  });
  return `${baseUrl}?${params.toString()}`;
};

// Update the calendar iframe src to apply theme changes
let updateCalendarUrl = () => {
  const iframe = document.getElementById("calendar-iframe");
  if (iframe && iframe.dataset.calendarId) {
    iframe.src = getCalendarUrl(iframe.dataset.calendarId, iframe.dataset.timezone || "UTC");
  }
};
