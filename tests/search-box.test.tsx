import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchBox } from "@/components/ui/search-box";

describe("SearchBox", () => {
  it("submits a trimmed query through its callback", () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} placeholder="Medicine name" />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "  paracetamol  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledWith("paracetamol");
  });

  it("does not submit an empty query", () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);

    expect(
      screen.getByRole("button", { name: "Search" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(onSearch).not.toHaveBeenCalled();
  });
});
