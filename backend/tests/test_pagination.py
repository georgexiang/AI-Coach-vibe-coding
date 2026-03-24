"""Tests for PaginatedResponse utility."""

from app.utils.pagination import PaginatedResponse


class TestPaginatedResponse:
    def test_create_calculates_total_pages(self):
        result = PaginatedResponse.create(
            items=["a", "b", "c"], total=10, page=1, page_size=3
        )
        assert result.items == ["a", "b", "c"]
        assert result.total == 10
        assert result.page == 1
        assert result.page_size == 3
        assert result.total_pages == 4  # ceil(10/3) = 4

    def test_create_exact_division(self):
        result = PaginatedResponse.create(items=[], total=20, page=2, page_size=10)
        assert result.total_pages == 2

    def test_create_single_page(self):
        result = PaginatedResponse.create(items=["x"], total=1, page=1, page_size=10)
        assert result.total_pages == 1

    def test_create_zero_page_size_returns_zero_pages(self):
        result = PaginatedResponse.create(items=[], total=5, page=1, page_size=0)
        assert result.total_pages == 0

    def test_create_empty_items(self):
        result = PaginatedResponse.create(items=[], total=0, page=1, page_size=20)
        assert result.total_pages == 0
        assert result.items == []
