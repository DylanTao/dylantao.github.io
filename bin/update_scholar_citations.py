#!/usr/bin/env python

import argparse
import os
import sys
import tempfile
from datetime import date, datetime

import yaml
from scholarly import scholarly


for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(line_buffering=True)
    except AttributeError:
        pass


def load_scholar_user_id() -> str:
    """Load the Google Scholar user ID from the configuration file."""
    config_file = "_data/socials.yml"
    if not os.path.exists(config_file):
        print(
            f"Configuration file {config_file} not found. Please ensure the file exists and contains your Google Scholar user ID."
        )
        sys.exit(1)
    try:
        with open(config_file, "r") as f:
            config = yaml.safe_load(f)
        scholar_user_id = config.get("scholar_userid")
        if not scholar_user_id:
            print(
                "No 'scholar_userid' found in the configuration file. Please add 'scholar_userid' to _data/socials.yml."
            )
            sys.exit(1)
        return scholar_user_id
    except yaml.YAMLError as e:
        print(
            f"Error parsing YAML file {config_file}: {e}. Please check the file for correct YAML syntax."
        )
        sys.exit(1)


SCHOLAR_USER_ID: str = load_scholar_user_id()
CITATIONS_FILE: str = "_data/citations.yml"
PUBLICATION_LENS_FILE: str = "_data/publication_lens.yml"


class IndentedSafeDumper(yaml.SafeDumper):
    """Format nested YAML lists in the same style Prettier expects."""

    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)


def load_yaml_file(path: str) -> dict:
    """Load a YAML file, returning an empty dictionary if it does not exist."""
    if not os.path.exists(path):
        return {}

    try:
        with open(path, "r") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        print(f"Warning: Could not read {path}: {e}. The file may be missing or corrupted.")
        return {}


def write_yaml_file(path: str, data: dict) -> None:
    """Write YAML atomically while keeping insertion order stable."""
    temp_path = None
    try:
        directory = os.path.dirname(path) or "."
        prefix = f".{os.path.basename(path)}."
        with tempfile.NamedTemporaryFile(
            "w",
            dir=directory,
            prefix=prefix,
            suffix=".tmp",
            delete=False,
            encoding="utf-8",
        ) as f:
            temp_path = f.name
            yaml.dump(data, f, Dumper=IndentedSafeDumper, width=1000, sort_keys=False)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(path):
            os.chmod(temp_path, os.stat(path).st_mode & 0o777)
        os.replace(temp_path, path)
        print(f"Data saved to {path}")
    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        print(f"Error writing data to {path}: {e}. Please check file permissions and disk space.")
        sys.exit(1)


def date_matches(value, expected_date: date) -> bool:
    """Compare YAML-loaded dates and strings against a date object."""
    if isinstance(value, datetime):
        return value.date() == expected_date
    if isinstance(value, date):
        return value == expected_date
    return str(value) == expected_date.isoformat()


def sync_publication_lens(citation_data: dict, sync_date: date) -> None:
    """Update Scholar Lens totals from citation data while preserving curated fields."""
    if not os.path.exists(PUBLICATION_LENS_FILE):
        print(f"No {PUBLICATION_LENS_FILE} file found. Skipping Scholar Lens sync.")
        return

    publication_lens = load_yaml_file(PUBLICATION_LENS_FILE)
    lens_papers = publication_lens.get("papers")
    citation_papers = citation_data.get("papers")

    if not isinstance(lens_papers, dict) or not isinstance(citation_papers, dict):
        print(f"Warning: Could not sync {PUBLICATION_LENS_FILE}; expected papers mappings.")
        return

    changed = False
    total_citations = 0

    for lens_key, lens_paper in lens_papers.items():
        if not isinstance(lens_paper, dict):
            print(f"Warning: Skipping malformed Scholar Lens paper entry: {lens_key}")
            continue

        scholar_pub_id = lens_paper.get("scholar_pub_id")
        if not scholar_pub_id:
            print(f"Warning: No scholar_pub_id set for Scholar Lens paper: {lens_key}")
            total_citations += int(lens_paper.get("citation_total") or 0)
            continue

        scholar_paper = citation_papers.get(scholar_pub_id)
        if not scholar_paper:
            print(f"Warning: No Google Scholar citation data found for {lens_key} ({scholar_pub_id}).")
            total_citations += int(lens_paper.get("citation_total") or 0)
            continue

        citation_total = int(scholar_paper.get("citations") or 0)
        total_citations += citation_total

        if lens_paper.get("citation_total") != citation_total:
            lens_paper["citation_total"] = citation_total
            changed = True

    metadata = publication_lens.setdefault("metadata", {})
    if not date_matches(metadata.get("last_synced"), sync_date):
        metadata["last_synced"] = sync_date
        changed = True

    if metadata.get("total_citations") != total_citations:
        metadata["total_citations"] = total_citations
        changed = True

    if changed:
        write_yaml_file(PUBLICATION_LENS_FILE, publication_lens)
    else:
        print("No changes in Scholar Lens citation data. Skipping file update.")


def get_scholar_citations(force: bool = False) -> None:
    """Fetch and update Google Scholar citation data."""
    print(f"Fetching citations for Google Scholar ID: {SCHOLAR_USER_ID}")
    today = datetime.now().date()
    today_string = today.isoformat()

    # Check if the output file was already updated today
    existing_data = load_yaml_file(CITATIONS_FILE)
    metadata = existing_data.get("metadata", {})
    if metadata and "last_updated" in metadata:
        print(f"Last updated on: {metadata['last_updated']}")
        if not force and date_matches(metadata["last_updated"], today):
            print("Citations data is already up-to-date. Skipping fetch.")
            sync_publication_lens(existing_data, today)
            return

    citation_data = {"metadata": {"last_updated": today_string}, "papers": {}}

    scholarly.set_timeout(15)
    scholarly.set_retries(3)
    try:
        author = scholarly.search_author_id(SCHOLAR_USER_ID)
        author_data = scholarly.fill(author)
    except Exception as e:
        print(
            f"Error fetching author data from Google Scholar for user ID '{SCHOLAR_USER_ID}': {e}. Please check your internet connection and Scholar user ID."
        )
        sys.exit(1)

    if not author_data:
        print(
            f"Could not fetch author data for user ID '{SCHOLAR_USER_ID}'. Please verify the Scholar user ID and try again."
        )
        sys.exit(1)

    if "publications" not in author_data:
        print(f"No publications found in author data for user ID '{SCHOLAR_USER_ID}'.")
        sys.exit(1)

    for pub in author_data["publications"]:
        try:
            pub_id = pub.get("pub_id") or pub.get("author_pub_id")
            if not pub_id:
                print(
                    f"Warning: No ID found for publication: {pub.get('bib', {}).get('title', 'Unknown')}. This publication will be skipped."
                )
                continue

            title = pub.get("bib", {}).get("title", "Unknown Title")
            year = pub.get("bib", {}).get("pub_year", "Unknown Year")
            citations = pub.get("num_citations", 0)

            print(f"Found: {title} ({year}) - Citations: {citations}")

            citation_data["papers"][pub_id] = {
                "title": title,
                "year": year,
                "citations": citations,
            }
        except Exception as e:
            print(
                f"Error processing publication '{pub.get('bib', {}).get('title', 'Unknown')}': {e}. This publication will be skipped."
            )

    if existing_data.get("papers") == citation_data["papers"] and date_matches(metadata.get("last_updated"), today):
        print("No changes in citation data. Skipping file update.")
    else:
        write_yaml_file(CITATIONS_FILE, citation_data)

    sync_publication_lens(citation_data, today)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update Google Scholar citation data.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Fetch Google Scholar data even if citations were already updated today.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    try:
        args = parse_args()
        get_scholar_citations(force=args.force)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)
