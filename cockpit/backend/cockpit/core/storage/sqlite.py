from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cockpit.core.storage.models import Base


class SqliteStorage:
    def __init__(self, url: str = "sqlite:///./cockpit.db"):
        kwargs = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool  # one shared connection for in-memory tests
        self.engine = create_engine(url, **kwargs)
        self._sessions = sessionmaker(self.engine, expire_on_commit=False)

    @contextmanager
    def session(self):
        s: Session = self._sessions()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    def create_tables(self) -> None:
        Base.metadata.create_all(self.engine)
