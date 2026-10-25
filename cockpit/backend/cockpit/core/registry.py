from cockpit.core.modules import Module, ToolSpec


class Registry:
    """Collects modules and their tools. Adding a module is one line in app creation."""

    def __init__(self, modules: list[Module] | None = None):
        self.modules: list[Module] = list(modules or [])

    def tools(self) -> dict[str, ToolSpec]:
        found: dict[str, ToolSpec] = {}
        for m in self.modules:
            for t in m.tools():
                if t.name in found:
                    raise ValueError(f"duplicate tool name: {t.name}")
                found[t.name] = t
        return found
