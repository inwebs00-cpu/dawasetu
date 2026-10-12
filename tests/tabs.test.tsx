import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs } from "@/components/ui/tabs";

describe("Tabs", () => {
  it("shows the selected panel and changes it when a tab is activated", () => {
    render(
      <Tabs
        items={[
          {
            value: "inventory",
            label: "Inventory",
            content: <p>Current stock</p>,
          },
          {
            value: "requests",
            label: "Requests",
            content: <p>Nearby requests</p>,
          },
        ]}
        defaultValue="inventory"
      />,
    );

    expect(screen.getByRole("tabpanel").textContent).toBe("Current stock");
    fireEvent.click(screen.getByRole("tab", { name: "Requests" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("Nearby requests");
  });
});
