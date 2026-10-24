# Current CV PDF reconstruction

**October 24 status:** reconstruction and the HCI alignment request are complete. The current public unpublished entry is `Manuscript under review.`; the [canonical recipe and latest receipt](../../../artwork/cv/README.md) own current facts and output bytes. Hashes, sizes and page captures below describe their dated checkpoints, rather than a request to restore an older PDF.

The previous public PDF was four readable Letter pages, but its paper status, industry description, mentorship list and lab-access awards had moved behind the current web/JSON CV. Its citation header reported July 2026 statistics. The first search found no native source in the repository, history or likely local folders. A bounded search of the connected Google Drive then recovered the matching public Google Doc and its DOCX export; the online document was read only, and no private general-CV source was used.

The recovered design uses Nunito body text, Raleway headings, a left date gutter, black section rules and blue hyperlinks. The editable native layout is a two-column table with 260 left-column paragraphs and manual spacers. The new [print source](../../../artwork/cv/README.md) keeps that design language while generating semantic HTML from the canonical public JSON. It retains the public records, research credits, rejection notes and personal wording. The initial reconstruction retained the then-public placeholder title; the later privacy refinement uses the under-review label above. It adds no acceptance claims, inferred dates or mentorship years. The earlier July statistics are omitted because they are absent from the current canonical CV, rather than being guessed or carried forward.

The initial rebuilt PDF was 167,212 bytes, four tagged Letter pages, SHA-256 `4e20e9ee24d573334548706030564b1a6f12a09b96a29c7231a24920326afcb8`. The [build receipt](../../../artwork/cv/build-receipt.json) binds the latest PDF to the JSON after CRLF-to-LF checkout normalization. The previous public PDF was 200,266 bytes, SHA-256 `47b94779bb12d3c6612e561e984589fcce9ae8e43d0898b678665338ae97b12e`.

The final page renders were inspected individually for text, spacing, section breaks, clipping, overlaps, glyphs and complete records:

- [Page 1](page-1.png): identity, education, publications and all seven mentees.
- [Page 2](page-2.png): research, industry and volunteering, including the new Smart Learning Hub and Autodesk descriptions.
- [Page 3](page-3.png): teaching, academic service and projects.
- [Page 4](page-4.png): honors and rejections, skills, languages, interests, references and the Bradley Voytek note.

Verification:

- The actual PDF passes four non-skipping acceptance tests: the 412 nonempty visible canonical string fields/keywords are present; all canonical destinations exist as native PDF links; four Letter pages retain tags, language and bookmarks; the source, output and record-count receipt matches. Text comparison expands standard font ligatures and folds layout whitespace without removing punctuation or words. URLs normalize only an empty HTTP(S) root path to `/`.
- The PDF has 69 external link annotations (57 unique destinations) and seven internal links to P5. Publication author order and the names of Autodesk mentors remain exact.
- An oversized fixture failed the page-area check and preserved the previous output sentinel. An earlier five-page attempt exposed the difference between browser viewport width and physical print width; the final builder composes at the exact 548-point printable width and checks the emitted page count before replacing the public PDF.
- Full Python suite: 261 tests passed in 20.8 seconds. Scoped Prettier, style contract and `git diff --check` passed.

The observed benefit is current content in the established four-page format, with one reproducible source instead of a second manually maintained factual record. PDF tags and the readable native outline support access, but no full PDF/UA or assistive-technology certification was attempted. Search recommendations or popularity were not measured by this change. Public route labels, reciprocal-format checks and generated-site verification belong to the coordinator's integration step.

## Skills alignment refinement

Sirui's review requested `HCI` in place of the long skill-category label. The PDF now uses that abbreviation and the same fixed gutter as the other entries, aligning all five skills descriptions with the main text column. The web/JSON category retains its full name, and every keyword remains. [The revised fourth page](page-4-hci-aligned.png) was rendered and inspected; the first three page renders are byte-identical to the original checkpoint. The fourth page's only text change is the approved abbreviation. Its five description starts and the main body share the measured X coordinate of 100.242183 points. Type size and four-page pagination remain unchanged. The refined PDF is 167,128 bytes, SHA-256 `f2452e482291e7b7a2ec994a70561a6bf25616d6058c2f7d99dd69259f4260cd`.
