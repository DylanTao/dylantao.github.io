# Contributed code-activity feeds

Approved sanitized daily feeds live here. The next run of
`python bin/import_code_activity.py --personal-repo ../DylanTao --repo-root .`
validates them and joins them to the public Build Rhythm figure. Public ids,
labels, and basis values are allowlisted in the importer; review that contract before
adding another source.

Once a source reaches the public snapshot, automatic refreshes may extend its
coverage but may not drop the source, move its start later, or move its end
earlier. A missing or narrowed feed fails closed and preserves the prior public
snapshot. Retiring a published source requires a separate, explicit contract
change; deleting its JSON file is not enough.

For the internship feed, use `_data/code_activity_sources/intern.json` with this
exact shape:

```json
{
  "schema": 1,
  "id": "intern",
  "label": "Intern work",
  "basis": "reported_daily_summary",
  "timezone": "UTC",
  "coverage": {
    "starts_on": "2026-06-15",
    "complete_through": "2026-06-15",
    "status": "complete"
  },
  "points": [
    {
      "date": "2026-06-15",
      "commits": 12,
      "authored_commits": 9,
      "additions": 1840,
      "deletions": 460
    }
  ]
}
```

This one-day sample is complete as written. A real points array must contain
every UTC date from `starts_on` through
`complete_through`, in order, and may contain completed days only. All counts
must be nonnegative integers, `authored_commits` cannot exceed `commits`, and a
day without an authored commit cannot report added or removed lines.
Use `commits` for the reported total, including merges and deploys, and
`authored_commits` for the non-merge, non-deploy subset that owns the line
counts.

The importer normalizes this feed to `date_basis: utc_calendar_date` and
`completion_timezone: UTC` in the public schema-5 source descriptor. Personal
activity instead uses GitHub profile author-date labels completed in
`America/Los_Angeles`. Public rows align matching `YYYY-MM-DD` labels from
those source calendars; they do not claim one shared timezone or 24-hour
interval.

The validator accepts only the documented fields. Do not include repository,
account, employer, commit, or other identifying fields. Dates outside this
feed's own coverage remain absent rather than being published as zero. Run the
importer with `--check` first when validating a new feed without writing the
public snapshot.
