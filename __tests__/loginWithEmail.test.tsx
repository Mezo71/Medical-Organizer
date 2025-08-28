// __tests__/loginWithEmail.simple.test.tsx
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// mocks
jest.mock("../app/lib/firebase", () => ({ auth: {} }));
jest.mock("firebase/auth", () => ({ signInWithEmailAndPassword: jest.fn() }));

import { signInWithEmailAndPassword } from "firebase/auth";
import LoginWithEmail from "../app/(auth)/loginWithEmail";

test("logs in with email + password", async () => {
    (signInWithEmailAndPassword as any).mockResolvedValue({});

    const { getByPlaceholderText, getByText } = render(<LoginWithEmail />);
    fireEvent.changeText(
        getByPlaceholderText("you@example.com"),
        "user@test.com"
    );
    fireEvent.changeText(getByPlaceholderText("Your password"), "secret");
    fireEvent.press(getByText("Log In"));

    await waitFor(() => {
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
            expect.anything(),
            "user@test.com",
            "secret"
        );
    });
});
