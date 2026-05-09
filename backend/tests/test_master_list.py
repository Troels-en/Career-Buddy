from career_buddy_scraper.master_list import merge, normalize_domain
from career_buddy_scraper.models import StageFocus, VcRecord


def test_normalize_domain_strips_scheme_and_subdomain() -> None:
    assert normalize_domain("https://www.cherry.vc/portfolio") == "cherry.vc"
    assert (
        normalize_domain("Picus Capital.com") == "picus capital.com"
    )  # falls back when invalid TLD parse


def test_normalize_domain_lowercases() -> None:
    assert normalize_domain("https://Cherry.VC") == "cherry.vc"


def test_merge_dedupes_by_domain_and_unions_sources() -> None:
    a = VcRecord(name="Cherry Ventures", domain="cherry.vc", sources=["openvc"])
    b = VcRecord(
        name="Cherry Ventures",
        domain="https://cherry.vc",
        careers_url="https://careers.cherry.vc",
        stage_focus=StageFocus.SEED,
        sources=["notion"],
    )
    merged = merge([a, b])
    assert len(merged) == 1
    only = merged[0]
    assert only.domain == "cherry.vc"
    assert only.careers_url == "https://careers.cherry.vc"
    assert only.stage_focus == StageFocus.SEED
    assert only.sources == ["notion", "openvc"]


def test_merge_keeps_distinct_domains() -> None:
    a = VcRecord(name="Cherry Ventures", domain="cherry.vc")
    b = VcRecord(name="Picus Capital", domain="picuscap.com")
    merged = merge([a, b])
    assert {r.domain for r in merged} == {"cherry.vc", "picuscap.com"}
