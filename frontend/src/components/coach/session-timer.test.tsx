import { render, screen, act } from "@testing-library/react";
import { SessionTimer } from "./session-timer";

// We test the formatElapsed logic by testing the component output directly.
// The formatElapsed function is not exported, so we validate it through rendered output.

describe("SessionTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 00:00 when startedAt is null", () => {
    render(<SessionTimer startedAt={null} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("formats seconds correctly (e.g. 59 seconds as 00:59)", () => {
    const startedAt = new Date(Date.now() - 59_000).toISOString();
    render(<SessionTimer startedAt={startedAt} />);
    expect(screen.getByText("00:59")).toBeInTheDocument();
  });

  it("formats 60 seconds as 01:00", () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    render(<SessionTimer startedAt={startedAt} />);
    expect(screen.getByText("01:00")).toBeInTheDocument();
  });

  it("updates the display after 1 second", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startedAt = new Date(now).toISOString();

    render(<SessionTimer startedAt={startedAt} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("00:01")).toBeInTheDocument();
  });
});
