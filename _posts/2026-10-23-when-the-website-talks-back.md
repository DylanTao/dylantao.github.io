---
layout: post
title: When the website talks back
date: 2026-10-23 00:00:00-0700
description: A few October design moves, the things that failed, and what they helped me see.
tags: design reflection website
categories: research
sidenotes: true
---

I have been keeping a studio log while rebuilding this website. The useful entries usually begin with something small going wrong: a mark that looks like a rendering bug, a line that runs too far, a blanket that refuses to behave like cloth. Writing down what I changed is easy. Writing down what the result made me reconsider takes more work.

Schön calls this a reflective conversation with the situation.[^schon] I like that framing because the site keeps answering back. A change can solve the thing I named and expose something I had not noticed. Here are a few of those conversations from October.

## The little mark that kept asking for attention

I wanted a quiet way to connect the site's interactive pieces to their project stories. The first mark looked like a slider. A hover disclosure was confusing. A small “story” label became loud when repeated. The final glint was quiet enough to look accidental.

Four versions, all circling the same problem: I was asking a mark to be almost invisible and easy to discover at the same time.

I removed it. The projects index and the case pages already give the work a labelled place to go. That felt less clever, and much easier to understand. The useful variable was no longer the mark's size or opacity. It was whether the reader could predict where a link would take them.

## A smaller file was still a large picture

A visual check kept failing on a page full of project images. My Windows browser captured it successfully, which made the failure on Linux feel arbitrary.

Looking at the images changed the question. One PNG was 3,838 by 1,588 pixels: about 24 MB once decoded into four-channel pixels, despite being a much smaller download. A gallery full of these asks the browser to hold far more than the reader sees.

Serving smaller WebP variants reduced that page's transfer from 33 MB to 5.2 MB in the local preview. More useful than that number was checking the actual failure environment: the revised pages completed sixteen repeated captures in the Linux browser image. Those are measurements of this site and that check, rather than a promise about every browser.

I had been treating the screenshot as a testing problem. The test was pointing at an image-design problem.

## Hidden has more than one meaning

The little companion on the homepage wandered over my research diagram on phones. It was supposed to avoid important content.

The diagram's canvas was marked `aria-hidden`, because nearby text already describes its meaning. The companion interpreted that attribute as permission to ignore the canvas. But being absent from the accessibility tree does not make something unimportant to a sighted reader.[^aria]

The fix was to name visual protection separately. That is a small implementation detail with a larger lesson for me: two parts of a system can read the same signal correctly for their own purpose and still disagree about what to do.

## Give the move a dimension

“Make it feel calmer” is a real reaction, but a difficult instruction to work with. In the log, I try to turn it into dimensions I can change and inspect: how often a label repeats, how long a line runs, how far a card travels, whether a figure starts moving before someone asks.

That helped with the publication previews. Two looping animations were doing work before a visitor had chosen to watch them. A poster frame with a play link made the page lighter and gave the reader control over the motion.[^motion] It also made the first view easier to compare with the surrounding papers.

The same approach helped with the small slips beneath my portrait. Their opposite tilts and staggered edges were meant to feel informal. They mostly looked misaligned. Giving them a shared edge did more than another round of shadows would have.

These are modest moves. I am keeping them because the sequence matters: name a question, change something, look at what actually happened, and revise the question. The log leaves room for the version that failed. Often that is the version that explains the next one.

[^schon]: Donald A. Schön, _The Reflective Practitioner: How Professionals Think in Action_ (1983). The [publisher's description](https://www.routledge.com/the-reflective-practitioner-how-professionals-think-in-action/schon/p/book/9781138458284) introduces reflection in action. The studio log borrows its framing; the website examples here are my own.

[^aria]: [WAI-ARIA 1.2, `aria-hidden`](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden) defines exclusion from the accessibility tree. The diagram retains its text alternative; the companion now uses a separate visual-protection marker.

[^motion]: [WCAG 2.2, Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) explains the need to control automatically moving content. A still poster also makes the choice to watch explicit.
