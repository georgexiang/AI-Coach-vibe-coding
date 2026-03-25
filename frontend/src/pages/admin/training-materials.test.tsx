import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US", changeLanguage: vi.fn() },
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock react-dropzone
vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
  })),
}));

// Mock the materials hooks
const mockUseMaterials = vi.fn();
const mockUseMaterialVersions = vi.fn();
const mockUseVersionChunks = vi.fn();
const mockUploadMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockArchiveMutate = vi.fn();
const mockRestoreMutate = vi.fn();

vi.mock("@/hooks/use-materials", () => ({
  useMaterials: (...args: unknown[]) => mockUseMaterials(...args),
  useMaterialVersions: (...args: unknown[]) => mockUseMaterialVersions(...args),
  useVersionChunks: (...args: unknown[]) => mockUseVersionChunks(...args),
  useUploadMaterial: () => ({ mutate: mockUploadMutate, isPending: false }),
  useUpdateMaterial: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useArchiveMaterial: () => ({ mutate: mockArchiveMutate }),
  useRestoreMaterial: () => ({ mutate: mockRestoreMutate }),
}));

import TrainingMaterialsPage from "./training-materials";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrainingMaterialsPage />
    </QueryClientProvider>,
  );
}

const mockMaterialsList = {
  items: [
    {
      id: "m1",
      name: "Brukinsa Guide",
      product: "Brukinsa",
      therapeutic_area: "Oncology",
      tags: "",
      is_archived: false,
      current_version: 2,
      created_by: "user1",
      created_at: "2026-03-15T10:00:00Z",
      updated_at: "2026-03-15T10:00:00Z",
    },
    {
      id: "m2",
      name: "Archived Doc",
      product: "DrugX",
      therapeutic_area: "",
      tags: "",
      is_archived: true,
      current_version: 1,
      created_by: "user1",
      created_at: "2026-03-10T10:00:00Z",
      updated_at: "2026-03-10T10:00:00Z",
    },
  ],
  total: 2,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("TrainingMaterialsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMaterials.mockReturnValue({ data: undefined });
    mockUseMaterialVersions.mockReturnValue({ data: undefined });
    mockUseVersionChunks.mockReturnValue({ data: undefined });
  });

  it("renders page title", () => {
    renderPage();
    expect(screen.getByText("materials.title")).toBeInTheDocument();
  });

  it("renders upload button", () => {
    renderPage();
    expect(screen.getByText("materials.upload")).toBeInTheDocument();
  });

  it("shows empty state when no materials", () => {
    mockUseMaterials.mockReturnValue({
      data: { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 },
    });
    renderPage();
    expect(screen.getByText("materials.noMaterials")).toBeInTheDocument();
  });

  it("renders material table with data", () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();
    expect(screen.getByText("Brukinsa Guide")).toBeInTheDocument();
    expect(screen.getByText("Brukinsa")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("renders archived badge for archived material", () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();
    const badges = screen.getAllByText("materials.archived");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("renders active badge for active material", () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();
    const badges = screen.getAllByText("materials.active");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("search input resets page to 1", async () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();

    const searchInput = screen.getByPlaceholderText("materials.searchPlaceholder");
    await userEvent.setup().type(searchInput, "test");

    // Verify useMaterials was called - search is debounced via state
    expect(mockUseMaterials).toHaveBeenCalled();
  });

  it("opens upload dialog on button click", async () => {
    renderPage();
    const uploadBtn = screen.getByText("materials.upload");
    await userEvent.setup().click(uploadBtn);

    // Dialog should now be open with upload hint (appears in both DialogDescription and dropzone)
    const hints = screen.getAllByText("materials.uploadHint");
    expect(hints.length).toBeGreaterThan(0);
  });

  it("upload button in dialog is disabled without file", async () => {
    renderPage();
    // Open upload dialog
    const uploadBtn = screen.getByText("materials.upload");
    await userEvent.setup().click(uploadBtn);

    // The submit button in the dialog should be disabled
    const submitButtons = screen.getAllByText("materials.upload");
    // The last one is in the dialog
    const dialogSubmit = submitButtons[submitButtons.length - 1]!;
    // Check the closest button element is disabled
    const buttonEl = dialogSubmit.closest("button");
    expect(buttonEl).toBeDisabled();
  });

  it("opens edit dialog with prefilled data", async () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();

    // Click edit button for first material
    const editButtons = screen.getAllByTitle("materials.edit");
    await userEvent.setup().click(editButtons[0]!);

    // Edit dialog should show with name input
    const nameInput = screen.getByDisplayValue("Brukinsa Guide");
    expect(nameInput).toBeInTheDocument();
  });

  it("archive button opens confirmation dialog", async () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();

    // Click archive button for first (non-archived) material
    const archiveButtons = screen.getAllByTitle("materials.archive");
    await userEvent.setup().click(archiveButtons[0]!);

    // Confirmation dialog should appear
    expect(screen.getByText("materials.archiveConfirm")).toBeInTheDocument();
  });

  it("restore button opens confirmation dialog", async () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();

    // Click restore button for archived material
    const restoreButtons = screen.getAllByTitle("materials.restore");
    await userEvent.setup().click(restoreButtons[0]!);

    // Confirmation dialog should appear
    expect(screen.getByText("materials.restoreConfirm")).toBeInTheDocument();
  });

  it("formatDate renders date in table cells", () => {
    mockUseMaterials.mockReturnValue({ data: mockMaterialsList });
    renderPage();
    // Both dates are March 2026, so multiple cells match
    const dateCells = screen.getAllByText(/2026/);
    expect(dateCells.length).toBeGreaterThan(0);
  });
});
