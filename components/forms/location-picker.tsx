"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type {
  LocationDistrictOption,
  LocationStateOption,
} from "@/services/location-directory";

interface AreaOption {
  id: string;
  name: string;
  postal_code: string | null;
}

export interface InitialAreaOption extends AreaOption {
  district_id: string;
  state_id: string;
}

export function LocationPicker({
  states,
  districts,
  initialArea,
  initialPostalCode = "",
  label = "Location",
  areaRequired = false,
  allowManual = true,
}: {
  states: LocationStateOption[];
  districts: LocationDistrictOption[];
  initialArea?: InitialAreaOption | null;
  initialPostalCode?: string;
  label?: string;
  areaRequired?: boolean;
  allowManual?: boolean;
}) {
  const initialStateId = initialArea?.state_id ?? states[0]?.id ?? "";
  const [stateId, setStateId] = useState(initialStateId);
  const availableDistricts = useMemo(
    () => districts.filter((district) => district.state_id === stateId),
    [districts, stateId],
  );
  const [districtId, setDistrictId] = useState(
    initialArea?.district_id ?? availableDistricts[0]?.id ?? "",
  );
  const [search, setSearch] = useState(initialArea?.name ?? "");
  const [areas, setAreas] = useState<AreaOption[]>(
    initialArea ? [initialArea] : [],
  );
  const [selectedArea, setSelectedArea] = useState<AreaOption | null>(
    initialArea ?? null,
  );
  const [manualPostalCode, setManualPostalCode] = useState(initialPostalCode);
  const [manualEntry, setManualEntry] = useState(
    allowManual && states.length === 0,
  );
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (
      !stateId ||
      !availableDistricts.some((district) => district.id === districtId)
    ) {
      setDistrictId(availableDistricts[0]?.id ?? "");
      setSelectedArea(null);
      setSearch("");
    }
  }, [availableDistricts, districtId, stateId]);

  useEffect(() => {
    if (manualEntry || !districtId || selectedArea) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({
          district_id: districtId,
          q: search,
        });
        const response = await fetch(`/api/locations/areas?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          areas?: AreaOption[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Search failed.");
        setAreas(payload.areas ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setAreas([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Area search is temporarily unavailable.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [districtId, manualEntry, search, selectedArea]);

  const selectedState = states.find((state) => state.id === stateId);
  const selectedDistrict = districts.find(
    (district) => district.id === districtId,
  );

  return (
    <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
      <legend className="px-1 text-sm font-medium text-slate-800">
        {label}
      </legend>
      {manualEntry ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Area / locality
              <Input name="area" maxLength={100} required={areaRequired} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              District
              <Input name="district" maxLength={100} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              State / Union Territory
              <Input name="state" maxLength={100} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              PIN code
              <Input
                name="postal_code"
                maxLength={6}
                inputMode="numeric"
                value={manualPostalCode}
                onChange={(event) => setManualPostalCode(event.target.value)}
              />
            </label>
          </div>
          {states.length > 0 && (
            <button
              type="button"
              className="justify-self-start text-sm font-medium text-teal-800 underline underline-offset-2"
              onClick={() => setManualEntry(false)}
            >
              Choose from Assam location list
            </button>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              State / Union Territory
              <select
                value={stateId}
                onChange={(event) => {
                  setStateId(event.target.value);
                  setSelectedArea(null);
                  setManualPostalCode("");
                  setSearch("");
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
              >
                <option value="">Choose a state</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              District
              <select
                value={districtId}
                disabled={!stateId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  setSelectedArea(null);
                  setManualPostalCode("");
                  setSearch("");
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15 disabled:bg-slate-100"
              >
                <option value="">Choose a district</option>
                {availableDistricts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Search area or PIN code
            <Input
              value={search}
              disabled={!districtId || Boolean(selectedArea)}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedArea(null);
              }}
              placeholder="Type a locality or six-digit PIN"
              required={areaRequired && !selectedArea}
              autoComplete="off"
            />
          </label>
          {selectedArea ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-teal-50 px-3 py-2.5 text-sm text-teal-950">
              <span>
                <strong>{selectedArea.name}</strong>
                {selectedArea.postal_code
                  ? ` · ${selectedArea.postal_code}`
                  : ""}
                {selectedDistrict ? ` · ${selectedDistrict.name}` : ""}
                {selectedState ? `, ${selectedState.name}` : ""}
              </span>
              <button
                type="button"
                className="font-medium text-teal-800 underline underline-offset-2"
                onClick={() => {
                  setSelectedArea(null);
                  setSearch("");
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200">
              {loading ? (
                <p className="px-3 py-2.5 text-sm text-slate-500">
                  Searching areas…
                </p>
              ) : searchError ? (
                <p role="alert" className="px-3 py-2.5 text-sm text-rose-800">
                  {searchError}
                </p>
              ) : areas.length ? (
                areas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-800 last:border-b-0 hover:bg-teal-50 focus-visible:bg-teal-50"
                    onClick={() => {
                      setSelectedArea(area);
                      setManualPostalCode("");
                      setSearch(area.name);
                    }}
                  >
                    {area.name}
                    {area.postal_code ? ` · ${area.postal_code}` : ""}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2.5 text-sm text-slate-500">
                  No area found in this district. Try another spelling
                  {allowManual ? " or enter the address manually." : "."}
                </p>
              )}
            </div>
          )}
          {allowManual && (
            <button
              type="button"
              className="justify-self-start text-sm font-medium text-teal-800 underline underline-offset-2"
              onClick={() => {
                setManualEntry(true);
                setSelectedArea(null);
              }}
            >
              Location not listed? Enter it manually
            </button>
          )}
          <input type="hidden" name="area_id" value={selectedArea?.id ?? ""} />
          <input type="hidden" name="area" value={selectedArea?.name ?? ""} />
          <input
            type="hidden"
            name="district"
            value={selectedDistrict?.name ?? ""}
          />
          <input type="hidden" name="state" value={selectedState?.name ?? ""} />
          <input
            type="hidden"
            name="postal_code"
            value={selectedArea?.postal_code ?? manualPostalCode}
          />
        </>
      )}
      {manualEntry && <input type="hidden" name="area_id" value="" />}
    </fieldset>
  );
}
