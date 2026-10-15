from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import REPO_DIR, Settings
from app.main import create_app
from tests.site_checks import assert_site_is_served

FRONTEND_BUILD = REPO_DIR / "frontend" / "out"


@pytest.mark.skipif(
    not (FRONTEND_BUILD / "index.html").is_file(),
    reason="needs a frontend build: run `npm run build` in frontend/",
)
def test_serves_the_real_frontend_build(tmp_path: Path):
    settings = Settings(db_path=tmp_path / "prelegal.db", static_dir=FRONTEND_BUILD)
    with TestClient(create_app(settings)) as client:
        assert_site_is_served(client)
