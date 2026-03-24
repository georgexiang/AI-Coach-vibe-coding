"""Singleton registry managing multiple adapter categories (llm, stt, tts, avatar)."""

from typing import Any


class ServiceRegistry:
    """Singleton registry managing multiple adapter categories."""

    _instance: "ServiceRegistry | None" = None
    _categories: dict[str, dict[str, Any]] = {}

    def __new__(cls) -> "ServiceRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._categories = {}
        return cls._instance

    def register(self, category: str, adapter: Any) -> None:
        """Register an adapter under a category (e.g., 'stt', 'tts', 'avatar', 'llm')."""
        if category not in self._categories:
            self._categories[category] = {}
        self._categories[category][adapter.name] = adapter

    def get(self, category: str, name: str) -> Any | None:
        """Get an adapter by category and name."""
        return self._categories.get(category, {}).get(name)

    def list_category(self, category: str) -> list[str]:
        """List all registered adapter names in a category."""
        return list(self._categories.get(category, {}).keys())

    async def discover_category(self, category: str) -> list[str]:
        """Check which adapters in a category are currently available."""
        available = []
        for name, adapter in self._categories.get(category, {}).items():
            if await adapter.is_available():
                available.append(name)
        return available

    def list_all_categories(self) -> dict[str, list[str]]:
        """Return all categories with their registered adapter names."""
        return {cat: list(adapters.keys()) for cat, adapters in self._categories.items()}


# Backward compatibility alias
AdapterRegistry = ServiceRegistry

registry = ServiceRegistry()
