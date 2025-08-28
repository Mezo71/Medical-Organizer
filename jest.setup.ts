// jest.setup.ts
import "@testing-library/jest-native/extend-expect";

// Mock expo-router so navigation calls don't crash tests
jest.mock("expo-router", () => ({
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

// If any util uses fetch (OCR/upload), provide a mock
(global as any).fetch = jest.fn();
