from app.services.agents.base import BaseCoachingAdapter


class AdapterRegistry:
    """Singleton registry for coaching adapters."""

    _instance = None
    _adapters: dict[str, BaseCoachingAdapter] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._adapters = {}
        return cls._instance

    def register(self, adapter: BaseCoachingAdapter) -> None:
        self._adapters[adapter.name] = adapter

    def get(self, name: str) -> BaseCoachingAdapter | None:
        return self._adapters.get(name)

    def list_available(self) -> list[str]:
        return list(self._adapters.keys())

    async def discover(self) -> list[str]:
        """Check which adapters are currently available."""
        available = []
        for name, adapter in self._adapters.items():
            if await adapter.is_available():
                available.append(name)
        return available


registry = AdapterRegistry()
