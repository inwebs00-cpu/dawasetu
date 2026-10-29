import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocationPicker } from "@/components/forms/location-picker";

const states = [{ id: "state-assam", name: "Assam" }];
const districts = [
  { id: "district-baksa", name: "Baksa", state_id: "state-assam" },
  { id: "district-barapeta", name: "Barpeta", state_id: "state-assam" },
];

describe("LocationPicker", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          areas: [
            {
              id: "area-mushalpur",
              name: "Mushalpur",
              postal_code: "781372",
            },
          ],
        }),
      }),
    );
  });

  it("searches the selected district and submits its area and PIN", async () => {
    const { container } = render(
      <form>
        <LocationPicker states={states} districts={districts} />
      </form>,
    );

    fireEvent.change(screen.getByLabelText("Search area or PIN code"), {
      target: { value: "Mushalpur" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Mushalpur/ }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("district_id=district-baksa"),
        expect.any(Object),
      );
    });
    expect(
      container.querySelector<HTMLInputElement>("[name=area_id]")?.value,
    ).toBe("area-mushalpur");
    expect(
      container.querySelector<HTMLInputElement>("[name=area]")?.value,
    ).toBe("Mushalpur");
    expect(
      container.querySelector<HTMLInputElement>("[name=district]")?.value,
    ).toBe("Baksa");
    expect(
      container.querySelector<HTMLInputElement>("[name=state]")?.value,
    ).toBe("Assam");
    expect(
      container.querySelector<HTMLInputElement>("[name=postal_code]")?.value,
    ).toBe("781372");
  });

  it("offers manual location entry for partner registrations", () => {
    render(<LocationPicker states={states} districts={districts} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Location not listed? Enter it manually",
      }),
    );

    expect(screen.getByLabelText("Area / locality")).toBeTruthy();
    expect(screen.getByLabelText("District")).toBeTruthy();
    expect(screen.getByLabelText("State / Union Territory")).toBeTruthy();
    expect(screen.getByLabelText("PIN code")).toBeTruthy();
  });
});
