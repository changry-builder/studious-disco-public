import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === "/api/today")
      return new Response(JSON.stringify({ date: "2026-10-24", items: [] }));
    return new Response(JSON.stringify({ message_id: "1", outcome: "reply", reply: "Got it: hello" }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

test("shows an empty Today and the capture box", async () => {
  stubFetch();
  render(<App />);
  expect(await screen.findByText(/Nothing due/)).toBeTruthy();
  expect(screen.getByLabelText("Tell me anything")).toBeTruthy();
});

test("sending a line posts it, clears the box and shows the reply", async () => {
  const fetchMock = stubFetch();
  render(<App />);
  const input = screen.getByLabelText("Tell me anything") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "hello" } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Got it: hello"));
  expect(input.value).toBe("");
  const post = fetchMock.mock.calls.find((c) => c[0] === "/api/messages")!;
  expect(JSON.parse(post[1]!.body as string).text).toBe("hello");
});
