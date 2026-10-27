import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routerPush, searchNearbyAction, findNearbyPublicBusinessesAction } =
  vi.hoisted(() => ({
    routerPush: vi.fn(),
    searchNearbyAction: vi.fn(),
    findNearbyPublicBusinessesAction: vi.fn(),
  }));

vi.mock("@/app/medicines/actions", () => ({ searchNearbyAction }));
vi.mock("@/app/pharmacies/actions", () => ({
  findNearbyPublicBusinessesAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

import { HomeSearch } from "@/components/search/home-search";

describe("HomeSearch", () => {
  beforeEach(() => {
    routerPush.mockReset();
    searchNearbyAction.mockReset();
    findNearbyPublicBusinessesAction.mockReset();
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

  it("shows nearby public pharmacies when location is searched without a medicine", async () => {
    findNearbyPublicBusinessesAction.mockResolvedValue({
      status: "ready",
      rows: [
        {
          business_id: "11111111-1111-4111-8111-111111111111",
          business_name: "LOKPALI MEDICO'S",
          business_slug: "lokpali-medicos",
          business_type: "Retail Pharmacy",
          address_line1: "Main Road",
          address_line2: null,
          postal_code: "788819",
          phone_e164: "+919957712819",
          whatsapp_e164: null,
          latitude: 25.17,
          longitude: 93.02,
          last_updated_at: "2026-10-27T00:00:00Z",
          distance_km: 2.3,
        },
      ],
    });
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
        name: "Find nearby pharmacies and medicine availability",
      }),
    );

    await waitFor(() =>
      expect(findNearbyPublicBusinessesAction).toHaveBeenCalledWith(
        19.076,
        72.8777,
      ),
    );
    expect(await screen.findByText("LOKPALI MEDICO'S")).toBeTruthy();
    expect(await screen.findByText("2.3 km away")).toBeTruthy();
    expect(screen.getByText(/Your precise location is used/)).toBeTruthy();
    expect(searchNearbyAction).not.toHaveBeenCalled();
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
        name: "Find nearby pharmacies and medicine availability",
      }),
    );

    expect(
      screen.getByText(/Allow location for this site in your browser/),
    ).toBeTruthy();
    expect(searchNearbyAction).not.toHaveBeenCalled();
  });
});
