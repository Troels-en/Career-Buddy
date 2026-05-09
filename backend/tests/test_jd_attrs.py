"""Unit tests for jd_attrs regex extractors."""

from __future__ import annotations

from career_buddy_scraper.jd_attrs import (
    extract_all,
    extract_languages,
    extract_salary,
    extract_years,
)

# ============================================================
# Years
# ============================================================


def test_years_plus_canonical() -> None:
    assert extract_years("3+ years of experience") == (3, None)


def test_years_range_canonical() -> None:
    assert extract_years("5-7 years experience required") == (5, 7)


def test_years_range_en_dash() -> None:
    assert extract_years("3–5 years in product roles") == (3, 5)


def test_years_minimum_phrasing() -> None:
    assert extract_years("Minimum 4 years in B2B sales") == (4, None)


def test_years_at_least_phrasing() -> None:
    assert extract_years("At least 2 years experience required") == (2, None)


def test_years_german_canonical() -> None:
    assert extract_years("Mindestens 3 Jahre Erfahrung im Beratungsumfeld") == (3, None)


def test_years_french_au_moins() -> None:
    assert extract_years("Au moins 5 ans d'expérience en finance") == (5, None)


def test_years_no_match_when_absent() -> None:
    assert extract_years("Looking for someone curious and ambitious") == (None, None)


def test_years_rejects_unrealistic_values() -> None:
    # 50+ years would mean someone over retirement — reject.
    assert extract_years("50+ years exposure") == (None, None)


def test_years_plain_phrasing() -> None:
    assert extract_years("4 years of experience in startups") == (4, None)


# ============================================================
# Salary
# ============================================================


def test_salary_dollar_full() -> None:
    assert extract_salary("Salary range: $120,000 - $150,000 per year") == (120000, 150000, "USD")


def test_salary_euro_k_suffix() -> None:
    # Note: "60-80k€" with currency AFTER number is an open edge case, we accept "€60-80k".
    assert extract_salary("€60-80k base") == (60000, 80000, "EUR")


def test_salary_up_to_phrasing() -> None:
    sal_min, sal_max, cur = extract_salary("Compensation: up to €120k")
    assert sal_min == 120000
    assert sal_max is None
    assert cur == "EUR"


def test_salary_rejects_unanchored_k_number() -> None:
    # "up to 20k users" is NOT a salary signal; require salary/comp prefix + currency context.
    assert extract_salary("Sumup serves up to 20k merchants in Germany") == (None, None, None)
    assert extract_salary("Team of 30k+ people across regions") == (None, None, None)


def test_salary_no_match_when_absent() -> None:
    assert extract_salary("Competitive package, equity, perks") == (None, None, None)


def test_salary_pound_range() -> None:
    assert extract_salary("£65,000 - £85,000 per annum") == (65000, 85000, "GBP")


# ============================================================
# Languages
# ============================================================


def test_lang_english_fluent() -> None:
    assert extract_languages("Fluent English required") == ["English"]


def test_lang_dual_with_fluency() -> None:
    out = extract_languages("Fluent in English and German required.")
    assert "English" in out
    assert "German" in out


def test_lang_german_fließend() -> None:
    out = extract_languages("Fließendes Deutsch und Englisch C1 erforderlich.")
    assert "German" in out
    assert "English" in out


def test_lang_no_signal_returns_empty() -> None:
    # The word "english" appears with no fluency hint.
    assert extract_languages("Communication mostly happens in English on Slack.") == []


def test_lang_french_business() -> None:
    out = extract_languages("Business level French required for client calls.")
    assert "French" in out


# ============================================================
# Combined
# ============================================================


def test_extract_all_aggregates_signals() -> None:
    text = (
        "We are looking for an Operating Associate with 5+ years experience. "
        "Compensation up to $140k. Fluent English required, German is a plus."
    )
    out = extract_all(text)
    assert out["years_min"] == 5
    assert out["years_max"] is None
    assert out["salary_min"] == 140000
    assert out["salary_currency"] == "USD"
    assert "English" in out["languages_required"]


def test_extract_all_handles_empty_inputs() -> None:
    out = extract_all("", "")
    assert out["years_min"] is None
    assert out["salary_min"] is None
    assert out["languages_required"] == []
