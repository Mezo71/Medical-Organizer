import {
    resolveKey,
    getUnit,
    getRangeStatus,
    fitToRangeMagnitude,
} from "../testDictionary";

test("dictionary helpers work on common fields", () => {
    // key normalization
    expect(resolveKey("rdw-cv")).toBe("RDWCV");

    // unit lookup
    expect(getUnit("HGB")).toBe("g/dL");
    expect(getUnit("WBC")).toBe("x10^9/L");

    // status
    expect(getRangeStatus("WBC", 2)).toBe("Low");
    expect(getRangeStatus("WBC", 7)).toBe("Normal");

    // OCR decimal fix (e.g., 134 -> ~13.4 for HGB)
    const fixed = fitToRangeMagnitude("HGB", 134);
    expect(fixed).toBeGreaterThan(12);
    expect(fixed).toBeLessThan(17.5);
});
