"""Alembic environment for V2 incremental changes.

The V1→V2 migration is NOT done through Alembic — it's the standalone
script at migrations/v1_to_v2.py because it's a one-shot data migration
with a TZ-inference step that Alembic can't express. Alembic is provided
here for FUTURE incremental changes (V2 → V2.1 etc.) once we're on V2.
"""
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

import os, sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

from app.core.database import Base
from app import models_v2  # noqa: F401 — register V2 tables

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()