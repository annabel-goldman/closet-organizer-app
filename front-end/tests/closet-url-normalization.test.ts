import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAttachmentResponse,
  normalizeAttachmentUrl,
} from "../src/app/lib/attachmentUrls.ts";

const originalWindow = globalThis.window;

test("normalizeAttachmentUrl rewrites localhost Active Storage URLs to same-origin paths in Vite dev", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:5173",
        port: "5173",
      },
    },
  });

  assert.equal(
    normalizeAttachmentUrl(
      "http://localhost:3000/rails/active_storage/blobs/redirect/abc123/test.png",
    ),
    "/rails/active_storage/blobs/redirect/abc123/test.png",
  );
});

test("normalizeAttachmentUrl leaves non-Active-Storage URLs untouched", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:5173",
        port: "5173",
      },
    },
  });

  assert.equal(
    normalizeAttachmentUrl("http://localhost:3000/uploads/item.png"),
    "http://localhost:3000/uploads/item.png",
  );
});

test("fetchAttachmentResponse follows local Active Storage redirects through normalized paths", async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:5173",
        port: "5173",
      },
    },
  });

  const requests: string[] = [];
  const response = await fetchAttachmentResponse(
    "http://localhost:3000/rails/active_storage/blobs/redirect/abc123/test.png",
    {},
    async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      requests.push(url);

      if (url.includes("/blobs/redirect/")) {
        return new Response(null, {
          status: 302,
          headers: {
            location: "http://127.0.0.1:3000/rails/active_storage/disk/def456/test.png",
          },
        });
      }

      return new Response("ok", { status: 200 });
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requests, [
    "/rails/active_storage/blobs/redirect/abc123/test.png",
    "/rails/active_storage/disk/def456/test.png",
  ]);
});

test.after(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});
