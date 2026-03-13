"""Central logging configuration for AISLA Care backend.

Creates a `logs/` directory and configures a rotating file handler
plus console output. Import and call `setup_logging()` early during
application startup (before heavy imports) to ensure logs are captured.
"""
from __future__ import annotations

import logging
import logging.handlers
import os
from typing import Optional


def setup_logging(log_dir: Optional[str] = None) -> None:
    """Configure root logger with console and rotating file handlers.

    - log_dir: directory to store log files. Defaults to `logs/` in cwd.
    """
    if log_dir is None:
        log_dir = os.path.join(os.getcwd(), "logs")

    os.makedirs(log_dir, exist_ok=True)

    log_file = os.path.join(log_dir, "aisla-backend.log")

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Console handler (stream)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(formatter)
    root_logger.addHandler(ch)

    # Rotating file handler
    fh = logging.handlers.RotatingFileHandler(
        filename=log_file,
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=5,
        encoding="utf-8",
    )
    fh.setLevel(logging.INFO)
    fh.setFormatter(formatter)
    root_logger.addHandler(fh)

    # Quiet noisy third-party loggers by default
    for noisy in ("uvicorn", "asyncio", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


__all__ = ["setup_logging"]
