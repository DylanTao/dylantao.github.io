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

  const counterUrl = (value) => new URL(value, window.location.href).href;

  const isLocalPreview = () => ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) || window.location.protocol === "file:";

  const fetchReadCount = async (url, mode) => {
    const shouldIncrement = mode === "increment" && !isLocalPreview();
    const response = await fetch(counterEndpoint, {
      credentials: "include",
      headers: {
        "x-bsz-referer": counterUrl(url),
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

    return count;
  };

  const groupedCounters = counters.reduce((groups, counter) => {
    const mode = counter.dataset.blogReadMode || "display";
    const url = counter.dataset.blogReadUrl;
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
