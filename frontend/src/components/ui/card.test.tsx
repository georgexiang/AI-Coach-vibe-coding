import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from "./card";

describe("Card", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<Card>Card content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveAttribute("data-slot", "card");
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom-card">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("custom-card");
  });
});

describe("CardHeader", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-header");
  });
});

describe("CardTitle", () => {
  it("renders heading text", () => {
    render(<CardTitle>My Title</CardTitle>);
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });
});

describe("CardDescription", () => {
  it("renders description text", () => {
    render(<CardDescription>My description</CardDescription>);
    expect(screen.getByText("My description")).toBeInTheDocument();
  });
});

describe("CardContent", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardContent>Body</CardContent>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-content");
  });
});

describe("CardFooter", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-footer");
  });
});

describe("CardAction", () => {
  it("renders with data-slot attribute", () => {
    const { container } = render(<CardAction>Action</CardAction>);
    expect(container.firstChild).toHaveAttribute("data-slot", "card-action");
  });
});
