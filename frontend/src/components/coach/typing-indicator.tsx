export function TypingIndicator() {
  return (
    <div
      className="rounded-lg bg-blue-500 px-4 py-2.5 text-white"
      aria-label="HCP is typing"
    >
      <div className="flex items-center gap-1">
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-white"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-white"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-white"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
