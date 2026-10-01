import { expect, it } from "vitest";
import { newEntry } from "../profile/editorData";
import {
  emptyCandidate,
  preferenceLists,
  profileProblem,
  profileResult,
  reviewResult,
} from "./profile";

it("requires bounded nonempty search criteria and complete preference responses", () => {
  for (const key of preferenceLists) {
    for (const values of [[" "], ["x".repeat(301)], Array.from({ length: 21 }, (_, i) => `${i}`)]) {
      const data = emptyCandidate();
      data.preferences[key] = values;
      expect(profileProblem(data)).not.toBeNull();
    }
    const data = emptyCandidate();
    data.preferences[key] = ["One", "one"];
    expect(profileProblem(data)).toMatch(/repeated job preferences/);
  }
  const data = emptyCandidate();
  const { excluded_keywords: _keywords, ...incomplete } = data.preferences;
  expect(() =>
    profileResult({
      version: 1,
      updated_at: "now",
      evidence_status: "user_provided",
      data: { ...data, preferences: incomplete },
    }),
  ).toThrow("Invalid profile response");
});

it("validates saved profile responses before exposing them to the editor", () => {
  const valid = {
    version: 1,
    updated_at: "now",
    evidence_status: "user_provided",
    data: emptyCandidate(),
  };
  expect(profileResult(valid)).toEqual(valid);
  for (const value of [
    null,
    { ...valid, version: -1 },
    { ...valid, evidence_status: "verified" },
    { ...valid, extra: true },
    { ...valid, data: { ...valid.data, preferences: {} } },
  ]) {
    expect(() => profileResult(value)).toThrow("Invalid profile response");
  }
});

it("checks chronology, education completion and duplicate preferences before save", () => {
  const data = emptyCandidate();
  expect(profileProblem(data)).toBeNull();
  data.education = [
    {
      ...newEntry("education"),
      institution: "Synthetic institute",
      qualification: "Synthetic course",
      current: true,
      completion: "completed",
    },
  ];
  expect(profileProblem(data)).toMatch(/Current education/);
  data.education[0] = {
    ...data.education[0],
    id: data.education[0]?.id ?? "",
    current: false,
    start_month: "2026-02",
    end_month: "2025-01",
  };
  expect(profileProblem(data)).toMatch(/Check dates in education/);
  data.education = [];
  data.preferences.target_roles = ["Engineer", "engineer"];
  expect(profileProblem(data)).toMatch(/repeated job preferences/);
});

it("accepts source-cited entries and rejects invalid pages or duplicate decisions", () => {
  const id = "12345678-1234-1234-1234-123456789012";
  const data = {
    ...emptyCandidate(),
    education: [
      {
        id,
        institution: "Synthetic university",
        qualification: "Synthetic course",
        field_of_study: "",
        start_month: "2026-01",
        end_month: "",
        current: false,
        completion: "unspecified",
        details: "",
      },
    ],
  };
  const citation = { document_id: id, page: 1, excerpt: "Synthetic course" };
  const valid = {
    version: 0,
    draft_sha256: "a".repeat(64),
    draft: {
      created_at: "now",
      status: "unreviewed",
      method: "assisted_import",
      payload: {
        data,
        warnings: [],
        evidence: [{ target: `education/${id}`, citations: [citation], notes: [] }],
      },
    },
    profile: {
      version: 0,
      updated_at: "",
      evidence_status: "user_provided",
      data: emptyCandidate(),
    },
    decisions: [],
  };
  expect(reviewResult(valid)).toEqual(valid);
  citation.page = 0;
  expect(() => reviewResult(valid)).toThrow();
  citation.page = 1;
  const decision = { target: `education/${id}`, decision: "approved", reviewed_at: "now" };
  expect(() => reviewResult({ ...valid, decisions: [decision, decision] })).toThrow();
});

it("rejects malformed profile responses and unexpected authority claims", () => {
  const valid = {
    version: 0,
    draft_sha256: "",
    draft: null,
    profile: {
      version: 0,
      updated_at: "",
      evidence_status: "user_provided",
      data: emptyCandidate(),
    },
    decisions: [],
  };
  expect(reviewResult(valid)).toEqual(valid);
  expect(() =>
    reviewResult({ ...valid, profile: { ...valid.profile, evidence_status: "verified" } }),
  ).toThrow();
  expect(() =>
    reviewResult({
      ...valid,
      decisions: [{ target: "full_name", decision: "approved", reviewed_at: "" }],
    }),
  ).toThrow();
  expect(() =>
    reviewResult({
      ...valid,
      profile: {
        ...valid.profile,
        data: { ...emptyCandidate(), skills: [{ id: "bad", name: "Skill" }] },
      },
    }),
  ).toThrow();
  expect(() =>
    reviewResult({
      ...valid,
      profile: { ...valid.profile, data: { ...emptyCandidate(), full_name: "x".repeat(301) } },
    }),
  ).toThrow();
});
