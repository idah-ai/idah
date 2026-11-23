import { describe, expect, it } from "vitest";
import { formatDuration, formatSeconds } from "./duration";

describe("formatDuration", () => {
  it("formats 0 seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats sub-minute values as m:ss", () => {
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(90)).toBe("1:30");
  });

  it("formats minutes as m:ss", () => {
    expect(formatDuration(1250)).toBe("20:50");
    expect(formatDuration(3223)).toBe("53:43");
  });

  it("formats hours as h:mm:ss", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(2 * 3600 + 5 * 60 + 7)).toBe("2:05:07");
  });

  it("rounds fractional seconds", () => {
    expect(formatDuration(10.4)).toBe("0:10");
    expect(formatDuration(10.6)).toBe("0:11");
  });

  it("clamps negative values to zero", () => {
    expect(formatDuration(-5)).toBe("0:00");
  });

  it("converts days into extra hours when total exceeds 24h", () => {
    expect(formatDuration(90000)).toBe("25:00:00"); // 25h
  });
});

describe("formatSeconds", () => {
  it("returns — for zero or negative", () => {
    expect(formatSeconds(0)).toBe("—");
    expect(formatSeconds(-5)).toBe("—");
  });

  it("formats sub-minute as 00:00:XX", () => {
    expect(formatSeconds(9)).toBe("00:00:09");
    expect(formatSeconds(45)).toBe("00:00:45");
  });

  it("formats minutes as 00:MM:SS", () => {
    expect(formatSeconds(60)).toBe("00:01:00");
    expect(formatSeconds(90)).toBe("00:01:30");
    expect(formatSeconds(3661)).toBe("01:01:01");
  });

  it("converts days into hours when total exceeds 24h", () => {
    expect(formatSeconds(90000)).toBe("25:00:00");
  });
});
