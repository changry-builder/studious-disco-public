from contextlib import AbstractContextManager
from typing import Protocol

from sqlalchemy.orm import Session


class Storage(Protocol):
    """All database access goes through this. Swapping SQLite for Postgres touches one file."""

    def session(self) -> AbstractContextManager[Session]: ...

    def create_tables(self) -> None: ...
