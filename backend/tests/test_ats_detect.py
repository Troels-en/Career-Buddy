from career_buddy_scraper.ats.ashby import AshbyAdapter
from career_buddy_scraper.ats.greenhouse import GreenhouseAdapter
from career_buddy_scraper.ats.lever import LeverAdapter
from career_buddy_scraper.ats.workable import WorkableAdapter


def test_greenhouse_detect_subdomain_path() -> None:
    assert GreenhouseAdapter().detect("https://boards.greenhouse.io/airbnb") == "airbnb"


def test_greenhouse_detect_subdomain_host() -> None:
    assert GreenhouseAdapter().detect("https://airbnb.greenhouse.io") == "airbnb"


def test_greenhouse_detect_miss() -> None:
    assert GreenhouseAdapter().detect("https://jobs.lever.co/airbnb") is None


def test_lever_detect() -> None:
    assert LeverAdapter().detect("https://jobs.lever.co/checkr") == "checkr"


def test_lever_detect_miss() -> None:
    assert LeverAdapter().detect("https://boards.greenhouse.io/checkr") is None


def test_ashby_detect() -> None:
    assert AshbyAdapter().detect("https://jobs.ashbyhq.com/clay") == "clay"


def test_workable_detect() -> None:
    assert WorkableAdapter().detect("https://apply.workable.com/sample-co/") == "sample-co"


def test_workable_detect_miss() -> None:
    assert WorkableAdapter().detect("https://example.com/careers") is None
