import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import UserManagementPage from "./users";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("UserManagementPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the page title and description", () => {
    render(<UserManagementPage />);
    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(
      screen.getByText("Manage platform users, roles and permissions"),
    ).toBeInTheDocument();
  });

  it("renders Import CSV and Add User buttons", () => {
    render(<UserManagementPage />);
    expect(screen.getByText("Import CSV")).toBeInTheDocument();
    expect(screen.getByText("Add User")).toBeInTheDocument();
  });

  it("renders the table header columns", () => {
    render(<UserManagementPage />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("BU")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders first page of users (10 users)", () => {
    render(<UserManagementPage />);
    // With 12 mock users and PAGE_SIZE=10, page 1 shows first 10
    expect(screen.getByText("Alice Wang")).toBeInTheDocument();
    expect(screen.getByText("Jack Yang")).toBeInTheDocument();
    // Users 11 and 12 should NOT be on page 1
    expect(screen.queryByText("Karen Xu")).not.toBeInTheDocument();
    expect(screen.queryByText("Leo Ma")).not.toBeInTheDocument();
  });

  it("shows pagination controls", () => {
    render(<UserManagementPage />);
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("navigates to page 2", async () => {
    render(<UserManagementPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Next"));
    // Page 2 should show remaining users
    expect(screen.getByText("Karen Xu")).toBeInTheDocument();
    expect(screen.getByText("Leo Ma")).toBeInTheDocument();
    // Page 1 users should no longer be visible
    expect(screen.queryByText("Alice Wang")).not.toBeInTheDocument();
  });

  it("Previous button is disabled on page 1", () => {
    render(<UserManagementPage />);
    const prevBtn = screen.getByText("Previous").closest("button");
    expect(prevBtn).toBeDisabled();
  });

  it("filters users by search query", async () => {
    render(<UserManagementPage />);
    const user = userEvent.setup();
    const searchInput = screen.getByPlaceholderText(
      "Search by name or email...",
    );
    await user.type(searchInput, "Alice");
    expect(screen.getByText("Alice Wang")).toBeInTheDocument();
    expect(screen.queryByText("Bob Zhang")).not.toBeInTheDocument();
  });

  it("shows 'No users found' when search yields no results", async () => {
    render(<UserManagementPage />);
    const user = userEvent.setup();
    const searchInput = screen.getByPlaceholderText(
      "Search by name or email...",
    );
    await user.type(searchInput, "zzzzzznotfound");
    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("renders user avatar initials", () => {
    render(<UserManagementPage />);
    expect(screen.getByText("AW")).toBeInTheDocument(); // Alice Wang
    expect(screen.getByText("BZ")).toBeInTheDocument(); // Bob Zhang
  });

  it("renders role badges", () => {
    render(<UserManagementPage />);
    // Multiple MR badges exist
    const mrBadges = screen.getAllByText("MR");
    expect(mrBadges.length).toBeGreaterThan(0);
    expect(screen.getAllByText("DM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("renders status indicators", () => {
    render(<UserManagementPage />);
    // Active and Inactive statuses should appear
    const activeStatuses = screen.getAllByText("Active");
    const inactiveStatuses = screen.getAllByText("Inactive");
    expect(activeStatuses.length).toBeGreaterThan(0);
    expect(inactiveStatuses.length).toBeGreaterThan(0);
  });

  it("resets page to 1 when search changes", async () => {
    render(<UserManagementPage />);
    const user = userEvent.setup();
    // Navigate to page 2 first
    await user.click(screen.getByText("Next"));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    // Type in search
    const searchInput = screen.getByPlaceholderText(
      "Search by name or email...",
    );
    await user.type(searchInput, "A");
    // Page should reset (pagination may or may not show depending on filtered count)
    // Just verify the search works
    expect(screen.queryByText("2 / 2")).not.toBeInTheDocument();
  });
});
