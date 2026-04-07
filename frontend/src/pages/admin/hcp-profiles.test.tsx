import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import HcpProfilesPage from "./hcp-profiles";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockDeleteMutate = vi.fn();
const mockRetrySyncMutate = vi.fn();
const mockBatchSyncMutate = vi.fn();

const profiles = [
  {
    id: "p1",
    name: "Dr. Chen",
    specialty: "Oncology",
    personality_type: "analytical",
    agent_id: "agent-1",
    agent_sync_status: "synced",
    voice_live_instance_id: null,
  },
  {
    id: "p2",
    name: "Dr. Li",
    specialty: "Cardiology",
    personality_type: "friendly",
    agent_id: "",
    agent_sync_status: "none",
    voice_live_instance_id: null,
  },
];

vi.mock("@/hooks/use-hcp-profiles", () => ({
  useHcpProfiles: () => ({
    data: { items: profiles, total: 2 },
    isLoading: false,
  }),
  useDeleteHcpProfile: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
  useRetrySyncHcpProfile: () => ({
    mutate: mockRetrySyncMutate,
    isPending: false,
  }),
  useBatchSyncAgents: () => ({
    mutate: mockBatchSyncMutate,
    isPending: false,
  }),
}));

// Mock the HcpTable component to expose its props for testing
let capturedTableProps: {
  profiles: typeof profiles;
  isLoading: boolean;
  onEdit: (profile: (typeof profiles)[0]) => void;
  onDelete: (id: string) => void;
  onRetrySync: (id: string) => void;
} | null = null;

vi.mock("@/components/admin/hcp-table", () => ({
  HcpTable: (props: {
    profiles: typeof profiles;
    isLoading: boolean;
    onEdit: (profile: (typeof profiles)[0]) => void;
    onDelete: (id: string) => void;
    onRetrySync: (id: string) => void;
  }) => {
    capturedTableProps = props;
    return (
      <div data-testid="hcp-table">
        {props.profiles.map((p) => (
          <div key={p.id} data-testid={`hcp-row-${p.id}`}>
            <span>{p.name}</span>
            <button onClick={() => props.onEdit(p)}>Edit {p.name}</button>
            <button onClick={() => props.onDelete(p.id)}>Delete {p.name}</button>
            <button onClick={() => props.onRetrySync(p.id)}>Retry {p.name}</button>
          </div>
        ))}
      </div>
    );
  },
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <HcpProfilesPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("HcpProfilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedTableProps = null;
  });

  it("renders the page with search input and create button", () => {
    renderPage();
    expect(screen.getByPlaceholderText("admin:hcp.searchPlaceholder")).toBeInTheDocument();
    expect(screen.getByText("admin:hcp.createButton")).toBeInTheDocument();
  });

  it("renders the HcpTable component", () => {
    renderPage();
    expect(screen.getByTestId("hcp-table")).toBeInTheDocument();
  });

  it("passes filtered profiles to HcpTable", () => {
    renderPage();
    expect(capturedTableProps).toBeTruthy();
    expect(capturedTableProps!.profiles).toHaveLength(2);
  });

  it("navigates to new profile page when create button is clicked", async () => {
    renderPage();
    const createButton = screen.getByText("admin:hcp.createButton").closest("button")!;
    await userEvent.click(createButton);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/hcp-profiles/new");
  });

  it("navigates to edit page when onEdit is triggered", async () => {
    renderPage();
    const editButton = screen.getByText("Edit Dr. Chen");
    await userEvent.click(editButton);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/hcp-profiles/p1");
  });

  it("shows delete confirmation dialog when onDelete is triggered", async () => {
    renderPage();
    const deleteButton = screen.getByText("Delete Dr. Chen");
    await userEvent.click(deleteButton);
    // Dialog should appear with delete confirmation
    expect(screen.getByText("admin:hcp.deleteConfirmWithAgent")).toBeInTheDocument();
  });

  it("calls deleteMutation when confirming delete", async () => {
    renderPage();
    // Trigger delete
    await userEvent.click(screen.getByText("Delete Dr. Chen"));
    // Confirm delete in the dialog -- there are multiple "common:delete" texts (title + button)
    const confirmButtons = screen.getAllByText("common:delete");
    // Click the destructive button (last one in the dialog footer)
    const destructiveButton = confirmButtons.find(
      (el) => el.closest("button")?.className.includes("destructive") || el.tagName === "BUTTON",
    );
    if (destructiveButton) {
      await userEvent.click(destructiveButton.closest("button") ?? destructiveButton);
    }
    expect(mockDeleteMutate).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("shows success toast on delete success", async () => {
    mockDeleteMutate.mockImplementation(
      (_id: string, opts: { onSuccess?: () => void }) => {
        opts?.onSuccess?.();
      },
    );
    renderPage();
    await userEvent.click(screen.getByText("Delete Dr. Chen"));
    const confirmButtons = screen.getAllByText("common:delete");
    const destructiveButton = confirmButtons[confirmButtons.length - 1]!;
    await userEvent.click(destructiveButton.closest("button") ?? destructiveButton);
    expect(toast.success).toHaveBeenCalledWith("common:delete");
  });

  it("shows error toast on delete failure", async () => {
    mockDeleteMutate.mockImplementation(
      (_id: string, opts: { onError?: () => void }) => {
        opts?.onError?.();
      },
    );
    renderPage();
    await userEvent.click(screen.getByText("Delete Dr. Chen"));
    const confirmButtons = screen.getAllByText("common:delete");
    const destructiveButton = confirmButtons[confirmButtons.length - 1]!;
    await userEvent.click(destructiveButton.closest("button") ?? destructiveButton);
    expect(toast.error).toHaveBeenCalledWith("admin:errors.hcpSaveFailed");
  });

  it("calls retrySyncMutation when retrying sync", async () => {
    renderPage();
    await userEvent.click(screen.getByText("Retry Dr. Chen"));
    expect(mockRetrySyncMutate).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("shows Sync All button when there are unsynced profiles", () => {
    renderPage();
    // Dr. Li has no agent_id and agent_sync_status "none"
    expect(screen.getByText(/Sync All/)).toBeInTheDocument();
  });

  it("calls batchSyncMutation when Sync All is clicked", async () => {
    renderPage();
    const syncAllButton = screen.getByText(/Sync All/).closest("button")!;
    await userEvent.click(syncAllButton);
    expect(mockBatchSyncMutate).toHaveBeenCalled();
  });

  it("closes delete dialog when cancel is clicked", async () => {
    renderPage();
    await userEvent.click(screen.getByText("Delete Dr. Chen"));
    expect(screen.getByText("admin:hcp.deleteConfirmWithAgent")).toBeInTheDocument();
    await userEvent.click(screen.getByText("common:cancel"));
    // Dialog content should be gone
    expect(screen.queryByText("admin:hcp.deleteConfirmWithAgent")).not.toBeInTheDocument();
  });
});
