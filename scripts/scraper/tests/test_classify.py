from career_buddy_scraper.classify import tier1_classify
from career_buddy_scraper.models import RoleCategory


def test_founders_associate_canonical() -> None:
    assert tier1_classify("Founders Associate") == RoleCategory.FOUNDERS_ASSOCIATE


def test_founders_associate_apostrophe() -> None:
    assert tier1_classify("Founder's Associate") == RoleCategory.FOUNDERS_ASSOCIATE


def test_chief_of_staff_acronym() -> None:
    assert tier1_classify("CoS to CEO") == RoleCategory.CHIEF_OF_STAFF


def test_investment_analyst() -> None:
    assert tier1_classify("Investment Analyst, Series A") == RoleCategory.INVESTMENT_ANALYST


def test_bizops_variants() -> None:
    assert tier1_classify("BizOps Lead") == RoleCategory.BIZOPS
    assert tier1_classify("Business Operations Manager") == RoleCategory.BIZOPS


def test_strategy_associate() -> None:
    assert tier1_classify("Strategy Associate") == RoleCategory.STRATEGY


def test_engineer_returns_none() -> None:
    assert tier1_classify("Senior Software Engineer") is None


def test_marketing_returns_none() -> None:
    assert tier1_classify("Growth Marketing Manager") is None
