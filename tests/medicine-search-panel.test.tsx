import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routerPush, searchNearbyAction, saveMyMedicineAction } = vi.hoisted(
  () => ({
    routerPush: vi.fn(),
    searchNearbyAction: vi.fn(),
    saveMyMedicineAction: vi.fn(),
  }),
);

vi.mock("@/app/medicines/actions", () => ({
  searchNearbyAction,
  saveMyMedicineAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

import { MedicineSearchPanel } from "@/components/search/medicine-search-panel";

function renderPanel() {
  return render(
    <MedicineSearchPanel
      query=""
      categorySlug={null}
      categories={[]}
      initialResult={{ status: "ready", rows: [] }}
      backendConfigured
    />,
  );
}

describe("MedicineSearchPanel location search", () => {
  beforeEach(() => {
    searchNearbyAction.mockReset();
  });

  it("uses a one-time location to search nearby inventory without a medicine query", async () => {
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

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));

    await waitFor(() =>
      expect(searchNearbyAction).toHaveBeenCalledWith(
        "",
        19.076,
        72.8777,
        null,
      ),
    );
    expect(
      screen.getByText(/Showing partner-reported availability by distance/),
    ).toBeTruthy();
  });

  it("explains how to fix a denied location permission", async () => {
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

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));

    expect(
      await screen.findByText(/Allow location for this site in your browser/),
    ).toBeTruthy();
    expect(searchNearbyAction).not.toHaveBeenCalled();
  });
});

describe("MedicineSearchPanel catalogue results", () => {
  beforeEach(() => {
    routerPush.mockReset();
    searchNearbyAction.mockReset();
  });

  it("shows catalogue results without claiming stock when live availability fails", () => {
    render(
      <MedicineSearchPanel
        query="Augmentin"
        categorySlug={null}
        categories={[]}
        backendConfigured
        initialResult={{
          status: "ready",
          rows: [],
          availabilityUnavailable: true,
          catalogRows: [
            {
              medicine_id: "11111111-1111-4111-8111-111111111111",
              product_name: "Augmentin 625 Tablet",
              brand_name: "Augmentin",
              composition: "Amoxicillin + Clavulanic Acid",
              strength: "625 mg",
              manufacturer_name: "Example Pharma",
              medicine_type: "tablet",
              prescription_class: "prescription",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Live pharmacy availability could not be checked",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Augmentin 625 Tablet")).toBeTruthy();
    expect(screen.getByText("Live stock unavailable")).toBeTruthy();
    expect(screen.queryByText("No public stock reported")).toBeNull();
  });
});
