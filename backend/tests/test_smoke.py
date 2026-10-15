"""Checks the running Docker container. Start it with scripts/start-*, then run `uv run pytest -m smoke`."""

import os

import httpx2
import pytest

from tests.site_checks import assert_accounts_work, assert_site_is_served

pytestmark = pytest.mark.smoke


def test_the_running_container_serves_the_site():
    base_url = os.environ.get("SMOKE_BASE_URL", "http://localhost:8000")
    with httpx2.Client(base_url=base_url, timeout=10) as client:
        assert_site_is_served(client)
        assert_accounts_work(client)
