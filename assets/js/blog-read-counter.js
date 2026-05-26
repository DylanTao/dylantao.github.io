(() => {
  const counterEndpoint = "https://bsz.saop.cc/api";
  const counterSelector = ".js-blog-read-count[data-blog-read-url]";
  const counters = Array.from(document.querySelectorAll(counterSelector));

  if (!counters.length) return;

  const formatReadCount = (count) => {
    const formattedCount = count.toLocaleString();
    return count === 1 ? "1 person read it" : `${formattedCount} people read it`;
  };

  const revealCounter = (counter, count) => {
    if (!Number.isFinite(count) || count < 1) {
      hideCounter(counter);
      return;
    }

    counter.textContent = formatReadCount(count);
    counter.hidden = false;

    const wrapper = counter.closest(".js-blog-read-count-wrap");
    if (wrapper) wrapper.hidden = false;
  };

  const hideCounter = (counter) => {
    counter.hidden = true;

    const wrapper = counter.closest(".js-blog-read-count-wrap");
    if (wrapper) wrapper.hidden = true;
  };

  const counterUrl = (value) => {
    const url = new URL(value, window.location.href);
    url.hash = "";
    return url.href;
  };

  const isLocalPreview = () => ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) || window.location.protocol === "file:";

  if (isLocalPreview()) {
    counters.forEach(hideCounter);
    return;
  }

  const fetchReadCount = async (url, mode) => {
    const canonicalUrl = counterUrl(url);
    const requestUrl = new URL(counterEndpoint);
    requestUrl.searchParams.set("referer", canonicalUrl);
    requestUrl.searchParams.set("_", Date.now().toString());
    const shouldIncrement = mode === "increment" && !isLocalPreview();
    const response = await fetch(requestUrl, {
      cache: "no-store",
      credentials: "include",
      headers: {
        "x-bsz-referer": canonicalUrl,
      },
      method: shouldIncrement ? "POST" : "GET",
    });

    if (!response.ok) {
      throw new Error(`read counter failed: ${response.status}`);
    }

    const payload = await response.json();
    const count = Number(payload?.data?.page_pv);

    if (!Number.isFinite(count)) {
      throw new Error("read counter returned no page_pv");
    }

    return shouldIncrement ? Math.max(count, 1) : count;
  };

  const groupedCounters = counters.reduce((groups, counter) => {
    const mode = counter.dataset.blogReadMode || "display";
    const url = counterUrl(counter.dataset.blogReadUrl);
    const key = `${mode}:${url}`;

    if (!groups.has(key)) {
      groups.set(key, {
        counters: [],
        mode,
        url,
      });
    }

    groups.get(key).counters.push(counter);
    return groups;
  }, new Map());

  groupedCounters.forEach(async ({ counters: groupCounters, mode, url }) => {
    try {
      const count = await fetchReadCount(url, mode);
      groupCounters.forEach((counter) => revealCounter(counter, count));
    } catch {
      groupCounters.forEach(hideCounter);
    }
  });
})();
