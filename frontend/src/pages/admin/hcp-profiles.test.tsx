import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HcpProfilesPage from "./hcp-profiles";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const profiles = [
  { id: "p1", name: "Dr. Chen", specialty: "Oncology", personality_type: "Analytical" },
  { id: "p2", name: "Dr. Li", specialty: "Cardiology", personality_type: "Friendly" },
];

vi.mock("@/hooks/use-hcp-profiles", () => ({
  useHcpProfiles: () => ({ data: { items: profiles, total: 2 } }),
  useHcpProfile: (id: string | undefined) => ({
    data: id ? profiles.find((p) => p.id === id) : undefined,
  }),
  useCreateHcpProfile: () => ({ mutate: mockCreateMutate }),
  useUpdateHcpProfile: () => ({ mutate: mockUpdateMutate }),
}));

vi.mock("@/components/admin/hcp-list", () => ({
  HcpList: (props: {
    profiles: unknown[];
    onSelect: (id: string) => void;
    onCreateNew: () => void;
    onSearchChange: (q: string) => void;
  }) => (
    <div data-testid="hcp-list">
      <button onClick={() => props.onSelect("p1")}>Select P1</button>
      <button onClick={() => props.onCreateNew()}>Create New</button>
    </div>
  ),
}));

vi.mock("@/components/admin/hcp-editor", () => ({
  HcpEditor: (props: {
    profile: unknown;
    onSave: (data: unknown) => void;
    onTestChat: () => void;
    onDiscard: () => void;
    isNew: boolean;
  }) => (
    <div data-testid="hcp-editor">
      <span>{props.isNew ? "Creating" : "Editing"}</span>
      <button onClick={() => props.onSave({ name: "Test" })}>Save</button>
      <button onClick={props.onTestChat}>Test Chat</button>
      <button onClick={props.onDiscard}>Discard</button>
    </div>
  ),
}));

vi.mock("@/components/admin/test-chat-dialog", () => ({
  TestChatDialog: (props: { open: boolean; profileName: string }) =>
    props.open ? <div data-testid="test-chat">{props.profileName}</div> : null,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HcpProfilesPage />
    </QueryClientProvider>
  );
}

describe("HcpProfilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the HCP list and empty state initially", () => {
    renderPage();
    expect(screen.getByTestId("hcp-list")).toBeInTheDocument();
    expect(screen.getByText("hcp.emptyBody")).toBeInTheDocument();
  });

  it("shows editor when selecting a profile", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Select P1"));
    expect(screen.getByTestId("hcp-editor")).toBeInTheDocument();
    expect(screen.getByText("Editing")).toBeInTheDocument();
  });

  it("shows editor in create mode when creating new", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Create New"));
    expect(screen.getByTestId("hcp-editor")).toBeInTheDocument();
    expect(screen.getByText("Creating")).toBeInTheDocument();
  });

  it("calls create mutation when saving new profile", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Create New"));
    await userEvent.setup().click(screen.getByText("Save"));
    expect(mockCreateMutate).toHaveBeenCalled();
  });

  it("calls update mutation when saving existing profile", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Select P1"));
    expect(screen.getByText("Editing")).toBeInTheDocument();
    await user.click(screen.getByText("Save"));
    expect(mockUpdateMutate).toHaveBeenCalled();
  });

  it("opens test chat dialog", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Select P1"));
    await userEvent.setup().click(screen.getByText("Test Chat"));
    expect(screen.getByTestId("test-chat")).toBeInTheDocument();
  });

  it("discards new profile creation", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Create New"));
    expect(screen.getByText("Creating")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Discard"));
    expect(screen.getByText("hcp.emptyBody")).toBeInTheDocument();
  });

  it("triggers create onSuccess callback", async () => {
    mockCreateMutate.mockImplementation((_data: unknown, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Create New"));
    await user.click(screen.getByText("Save"));
    expect(mockCreateMutate).toHaveBeenCalled();
    // After onSuccess, isCreatingNew should be false
    // The empty state should show since we cleared creating mode
    expect(screen.getByText("hcp.emptyBody")).toBeInTheDocument();
  });

  it("triggers create onError callback", async () => {
    mockCreateMutate.mockImplementation((_data: unknown, opts: { onError?: () => void }) => {
      opts?.onError?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Create New"));
    await user.click(screen.getByText("Save"));
    expect(mockCreateMutate).toHaveBeenCalled();
  });

  it("triggers update onSuccess callback", async () => {
    mockUpdateMutate.mockImplementation((_data: unknown, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Select P1"));
    await user.click(screen.getByText("Save"));
    expect(mockUpdateMutate).toHaveBeenCalled();
  });

  it("triggers update onError callback", async () => {
    mockUpdateMutate.mockImplementation((_data: unknown, opts: { onError?: () => void }) => {
      opts?.onError?.();
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText("Select P1"));
    await user.click(screen.getByText("Save"));
    expect(mockUpdateMutate).toHaveBeenCalled();
  });
});
