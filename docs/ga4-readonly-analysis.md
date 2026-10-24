# Private, read-only GA4 analysis

Use existing aggregate Google Analytics data to choose a small website improvement. This local utility does not add tracking, alter consent or event settings, send collection events, or publish reports. The site's academic outcomes remain research comprehension, useful resource access, and appropriate relationship decisions; longer visits and more clicks are diagnostics rather than goals. See the [analytics review](design-reviews/2026-10-24/ANALYTICS_REVIEW.md) for definitions and limitations.

## Current access boundary

**October 24 completion:** authorized property-level Viewer access and a real read-only aggregate export have been verified locally. The executed analysis, reports, configuration and credential remain in the ignored `.codex/local/analytics/` directory. On Sirui's machine, start with `LOCAL_SETUP.md` there; a fresh clone will not contain these private files. This closes the reporting-access task, not the separate consent/settings, outcome-measurement or Search Console questions.

The site's public measurement ID identifies a web stream; it does not grant reporting access. The GA4 Data API requires a separate [numeric property ID](https://developers.google.com/analytics/devguides/reporting/data/v1/property-id), such as the supplied property `467687350`, and an authorized Google identity. No account data was accessed while preparing this utility. Its tests use synthetic fixtures.

The script supports a dedicated service account with the `https://www.googleapis.com/auth/analytics.readonly` scope. A property-level **Viewer** role is sufficient for reading reports. Neither Editor nor Administrator access is needed. [Google role definitions](https://support.google.com/analytics/answer/9305587?hl=en), [Data API authorization](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport)

## One-time setup

1. In a Google Cloud project you control, enable the **Google Analytics Data API**. Follow [Google's API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart).
2. Create a dedicated service account for this local reporting task. It does not need a Google Cloud project role for GA4 reporting.
3. In Google Analytics, select this website's property. Open **Admin → Property access management**, add the service account's email address, and grant **Viewer** on this property only. Confirm the numeric property ID in Property settings.
4. In Google Cloud, open the service account's **Keys** tab, choose **Add key → Create new key → JSON**, and save the downloaded JSON locally as:

   ```text
   D:/dev/dylantao.github.io/.codex/local/analytics/ga4-reader.json
   ```

   Do not paste its private key into chat, commit it, place it under `assets/`, or add it to a public hosting environment. This is a credential file, not a GA measurement API secret. Restrict local access to your Windows account; revoke the key and remove its GA access when it is no longer needed. If your organization disables key creation, use its approved authentication route rather than weakening that policy.

5. Install the optional local dependencies:

   ```powershell
   python -m pip install -r requirements-analytics.txt
   ```

All local configuration, credentials, and report exports belong inside `.codex/local/analytics/`. That entire directory is gitignored, and `.codex/` is explicitly excluded from Jekyll. The utility verifies ignored storage before authenticating and rejects output outside this private directory, including escaping symlinks. Private files are not part of the site or CI artifacts.

OAuth through a Desktop application is an alternative when avoiding a service-account key is preferable. Google supports browser authorization with a local loopback callback. This utility does not implement that flow or accept arbitrary OAuth token files. [Google's desktop OAuth documentation](https://developers.google.com/identity/protocols/oauth2/native-app)

## Preview and run

Preview the fixed requests without Google dependencies, credentials, network requests, or file writes:

```powershell
python bin/ga4_report.py --plan --property-id 467687350
```

Optionally create `.codex/local/analytics/config.json` locally:

```json
{
  "property_id": "467687350",
  "credentials": ".codex/local/analytics/ga4-reader.json"
}
```

Run the export explicitly once access is ready:

```powershell
python bin/ga4_report.py --property-id 467687350
```

The default window contains 90 inclusive days, ending two UTC calendar days before execution. This buffer avoids current/partial property days and allows initial processing; it does not guarantee all late processing is complete. Use explicit dates for a reproducible comparison:

```powershell
python bin/ga4_report.py --property-id 467687350 --start 2026-07-25 --end 2026-10-22
```

All dates are inclusive and must end at least two UTC calendar days ago. The maximum window is 366 days. A new timestamped private report directory is created only after every report completes. Existing reports are never overwritten; any failed request or incomplete pagination prevents a snapshot being written. `--output .codex/local/analytics/reports/baseline-2026-10-22` can name a new private directory.

## What is collected from the reporting API

Every preset filters `hostName` to exactly `dylantao.github.io`. This is a report-time filter; it does not change the property's stored data or settings. The first authenticated operations check the selected dimensions/metrics for compatibility, followed by the fixed aggregate reports.

| Report           | Dimensions                      | Intended question                                          |
| ---------------- | ------------------------------- | ---------------------------------------------------------- |
| Overview         | None                            | What is the size of the measured baseline?                 |
| Daily            | Date                            | Are trends concentrated around releases or announcements?  |
| Landing pages    | Path, device class              | Which entry points deserve desktop/mobile attention?       |
| Pages            | Path, device class              | Which public content receives measured use?                |
| Acquisition      | Session source/medium, device   | Does a changing source mix explain an apparent change?     |
| Events           | Event name                      | Which existing event definitions actually have data?       |
| Downloads        | File extension, source path     | Do existing `file_download` events cover useful resources? |
| Outbound domains | Destination domain, source path | Where do existing outbound `click` actions lead?           |

The requests use path-only `landingPage`/`pagePath`. They do not request raw query strings, search text, full referring URLs, arbitrary link URLs/text, user identifiers, precise location, demographics, or visitor-level exports. [Google's dimension/metric definitions](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)

The private `snapshot.json` retains the exact requests, scope, production hostname, inclusive date range, retrieval time, repository revision, response headers, complete paginated rows, and per-page quota/quality metadata. Metadata includes the returned property timezone, sampling information, thresholding status, and possible `(other)` row data loss; absent fields are retained as absent rather than interpreted as proof of complete coverage. [Google response metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData)

Pagination uses stable dimension ordering and verifies row counts, headers, and unique dimension combinations. Changed counts/headers, repeated rows, early empty pages, or more than 100,000 rows stop the export. GA does not promise an atomic multi-request snapshot: unchanged counts alone cannot rule out late revisions. Use a historical window and retain retrieval times. Treat sparse cells and thresholds as limitations, not zeros to explain away.

API/authentication failures print bounded status guidance, without echoing provider error bodies, request headers, tokens, or credential contents. Reports stay private unless Sirui separately chooses a reviewed, suitably aggregated finding to publish.

## Turn evidence into a restrained design decision

First establish event meaning and coverage. The existing helper mixes load milliseconds and elapsed seconds under `timing_complete`; never aggregate its `value`. Downloads and clicks may overlap, missing custom dimensions are not retroactive, and a direct external PDF entry may bypass the website tag. This export does not audit consent, retention, filters, key-event definitions, or enhanced-measurement settings.

Choose one concrete question, such as whether mobile visitors entering through the CV can find the relevant research context. Compare comparable entry/device groups over equivalent windows and inspect the rendered route with a task in mind. Annotate announcements, conferences, releases, and instrumentation changes. A few reader tasks can explain a confusing label more directly than a small change in engagement rate.

Keep counts and denominators explicit. Unique users must not be summed across rows or dates; page-level sessions can overlap too. Neither event sums nor totals across resource types establish a distinct-session resource-access rate. Validate a deduplicated session definition before reporting that rate. Resource activation is an attempt, not proof of reading, reuse, citation, or a sent inquiry.

AI-associated source/medium traffic can corroborate measured referrals, but GA cannot establish AI-search rank, all AI-mediated visits, or why someone chose a CV. Preserve Sirui's identity and accessibility even when an attention metric points toward louder presentation. A clearer successful visit may become shorter.

## Verification

```powershell
python -m unittest discover -s test -p "test_ga4_report.py"
git check-ignore .codex/local/analytics/ga4-reader.json
git diff --check
```

The offline tests cover the plan without site packages, fixed privacy filters, date/property validation, guarded private storage, complete pagination and metadata, schema checks, endpoint restrictions, and suppression of synthetic secret-bearing errors. A passing test suite alone does not establish valid credentials, property access, historical event coverage, or a measured website improvement. The separate authenticated export established local reporting access on October 24; the private analysis records the report's scope and coverage limits.
