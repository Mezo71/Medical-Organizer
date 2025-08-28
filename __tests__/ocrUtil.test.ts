import { extractTextFromImage } from "../utils/ocr";

beforeEach(() => (global.fetch as jest.Mock).mockReset()); //Resets the mocked fetch before every test

test("extractTextFromImage posts and returns texts[]", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ texts: ["HGB 13.4", "WBC 6.2"] }),
    });

    const lines = await extractTextFromImage("file:///tmp/test.jpg");
    expect(global.fetch).toHaveBeenCalled();
    expect(lines).toEqual(["HGB 13.4", "WBC 6.2"]);
});
