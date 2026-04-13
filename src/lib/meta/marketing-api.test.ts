import { describe, it, expect } from "vitest";
import { summarizeTargeting } from "./marketing-api";

describe("summarizeTargeting", () => {
  it("handles null/undefined/empty input safely", () => {
    expect(summarizeTargeting(null)).toEqual({
      age_min: null,
      age_max: null,
      genders: ["all"],
      geo_countries: [],
      geo_regions: [],
      geo_cities: [],
      interests_count: 0,
      behaviors_count: 0,
      custom_audiences_count: 0,
      raw_locales: [],
    });
    expect(summarizeTargeting(undefined)).toEqual(summarizeTargeting(null));
    expect(summarizeTargeting({})).toEqual(summarizeTargeting(null));
  });

  it("maps genders 1 → male, 2 → female, else → all", () => {
    expect(summarizeTargeting({ genders: [1] }).genders).toEqual(["male"]);
    expect(summarizeTargeting({ genders: [2] }).genders).toEqual(["female"]);
    expect(summarizeTargeting({ genders: [1, 2] }).genders).toEqual(["male", "female"]);
    expect(summarizeTargeting({ genders: [0] }).genders).toEqual(["all"]);
  });

  it("extracts age_min/age_max only when numeric", () => {
    expect(summarizeTargeting({ age_min: 25, age_max: 45 })).toMatchObject({
      age_min: 25,
      age_max: 45,
    });
    expect(summarizeTargeting({ age_min: "25" })).toMatchObject({
      age_min: null,
    });
  });

  it("extracts geo_locations countries/regions/cities names", () => {
    const t = {
      geo_locations: {
        countries: ["BR", "AR"],
        regions: [{ name: "São Paulo" }, { name: "Rio de Janeiro" }],
        cities: [{ name: "São Paulo" }, { name: "Curitiba" }],
      },
    };
    const r = summarizeTargeting(t);
    expect(r.geo_countries).toEqual(["BR", "AR"]);
    expect(r.geo_regions).toEqual(["São Paulo", "Rio de Janeiro"]);
    expect(r.geo_cities).toEqual(["São Paulo", "Curitiba"]);
  });

  it("counts interests, behaviors, custom_audiences from arrays", () => {
    const t = {
      interests: [{ id: "1" }, { id: "2" }, { id: "3" }],
      behaviors: [{ id: "b1" }],
      custom_audiences: [{ id: "a1" }, { id: "a2" }],
    };
    const r = summarizeTargeting(t);
    expect(r.interests_count).toBe(3);
    expect(r.behaviors_count).toBe(1);
    expect(r.custom_audiences_count).toBe(2);
  });

  it("skips region/city entries without name", () => {
    const t = {
      geo_locations: {
        regions: [{ name: "" }, { key: "missing-name" }, { name: "Paraná" }],
        cities: [{ name: "Curitiba" }, {}],
      },
    };
    const r = summarizeTargeting(t);
    expect(r.geo_regions).toEqual(["Paraná"]);
    expect(r.geo_cities).toEqual(["Curitiba"]);
  });
});
