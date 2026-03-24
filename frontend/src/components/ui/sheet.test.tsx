import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet";

describe("Sheet", () => {
  it("renders trigger button", () => {
    render(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
      </Sheet>,
    );
    expect(screen.getByText("Open Sheet")).toBeInTheDocument();
  });

  it("renders SheetHeader with custom className", () => {
    const { container } = render(
      <SheetHeader className="test-header">Header content</SheetHeader>,
    );
    const header = container.firstChild as HTMLElement;
    expect(header.className).toContain("test-header");
    expect(header).toHaveAttribute("data-slot", "sheet-header");
  });

  it("renders SheetFooter with custom className", () => {
    const { container } = render(
      <SheetFooter className="test-footer">Footer content</SheetFooter>,
    );
    const footer = container.firstChild as HTMLElement;
    expect(footer.className).toContain("test-footer");
    expect(footer).toHaveAttribute("data-slot", "sheet-footer");
  });

  it("renders SheetTitle and SheetDescription", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>My Title</SheetTitle>
          <SheetDescription>My Description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("My Description")).toBeInTheDocument();
  });
});
