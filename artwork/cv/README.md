# Current public CV print source

The public PDF is built from `assets/json/resume.json`, the same record used by the web CV and the machine-readable download. `bin/build_cv_pdf.mjs` is the editable layout source. `_data/resume.json` must remain byte-identical to the public JSON; the builder refuses a mismatch.

From the repository root:

```powershell
npm.cmd ci
npx.cmd playwright install chromium
python -m pip install -r requirements-cv-pdf.txt
node bin/build_cv_pdf.mjs
python -m unittest discover -s test -p test_cv_pdf.py -v
```

The command replaces `assets/pdf/Sirui_Tao_CV_Public.pdf` and this directory's `build-receipt.json`. Inspect all four pages before committing both files together. The receipt binds the JSON source after CRLF-to-LF checkout normalization, the exact PDF output bytes and record counts. No other source normalization is applied. PDF creation timestamps can change between builds; reproducibility means the same public claims, typography and pagination, not identical timestamped PDF bytes.

The intermediate HTML and measurements stay in `.jekyll-cache/cv-pdf/`. For a candidate PDF without replacing the public artifact, pass an output path:

```powershell
node bin/build_cv_pdf.mjs .jekyll-cache/cv-pdf/candidate.pdf
pdftoppm -scale-to 1600 -png .jekyll-cache/cv-pdf/candidate.pdf .jekyll-cache/cv-pdf/candidate
```

The design retains the previous public CV's Nunito text, Raleway section headings, date gutter, black rules, blue links, rejection notes and Bradley Voytek credit. The original editable public Google Doc was recovered read-only on October 23, 2026. Its two-column table aligns dates with hundreds of manual spacer paragraphs, so this source reconstructs the established design with semantic HTML and explicit page groups. The online original was not edited. Its full DOCX export and the old PDF render are retained as local comparison evidence, outside the deployed site.

Every current public record is present, including the newer industry work, all seven mentees, teaching, service, projects, skills, languages, interests and references. The unpublished `XXX: abcdefg` title remains unchanged. The previous PDF's July citation statistics were removed because the current canonical CV does not carry those statistics. No new citation total, h-index, acceptance, date or mentorship year was inferred.

The source uses four authored Letter pages. If new content no longer fits, the builder fails before replacing the PDF. Revise the grouping or explicitly redesign pagination; do not shrink the type to conceal overflow. New nonempty certificates or unrecognized top-level sections also fail until their print layout is added. The output retains selectable text, PDF tags, document language, headings/bookmarks and native URL/internal-paper links. Passing these structural checks is not a claim of a full PDF/UA or screen-reader audit.

Fonts and their licenses live in [fonts](fonts/NOTICE.md). The source directory is excluded from Jekyll output by the existing `artwork/` rule; the generated PDF is the public deliverable.

The PDF uses `HCI` for the Human-Computer Interaction skill label so every skills description aligns with the standard body column. The web/JSON category keeps its full name.
