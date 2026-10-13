import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routerPush, searchNearbyAction } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  searchNearbyAction: vi.fn(),
}));

vi.mock("@/app/medicines/actions", () => ({ searchNearbyAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

import { HomeSearch } from "@/components/search/home-search";

describe("HomeSearch", () => {
  beforeEach(() => {
    routerPush.mockReset();
    searchNearbyAction.mockReset();
  });

  it("opens database search results for a medicine query", () => {
    render(<HomeSearch />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "paracetamol 500 mg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(routerPush).toHaveBeenCalledWith(
      "/medicines?q=paracetamol%20500%20mg",
    );
  });

  it("runs a location-only search from the homepage without saving coordinates", async () => {
    searchNearbyAction.mockResolvedValue({ status: "ready", rows: [] });
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 19.076,
          longitude: 72.8777,
        } as GeolocationCoordinates,
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<HomeSearch />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use my location for nearby medicine availability",
      }),
    );

    await waitFor(() =>
      expect(searchNearbyAction).toHaveBeenCalledWith(
        "",
        19.076,
        72.8777,
        null,
      ),
    );
    expect(await screen.findByText("No current matches nearby")).toBeTruthy();
    expect(screen.getByText(/Your precise location is used/)).toBeTruthy();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("explains when the visitor denies location access", () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 1,
          message: "Permission denied",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      },
    );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<HomeSearch />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use my location for nearby medicine availability",
      }),
    );

    expect(
      screen.getByText(/Allow location for this site in your browser/),
    ).toBeTruthy();
    expect(searchNearbyAction).not.toHaveBeenCalled();
  });
});
