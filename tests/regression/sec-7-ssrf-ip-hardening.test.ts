// SEC-7 — SSRF scanner bypass / loopback & private range evasion.
//
// Bug (found 2026-07, security review): isSafeWorkerUrl only blocked basic
//   strings like "127.0.0.1" and "10.", leaving other loopback subnets (127.0.0.2),
//   IPv6 local subnets (fc00::/7, fe80::/10), carrier-grade NAT ranges (100.64.0.0/10),
//   and IPv4-mapped IPv6 ranges accessible, which could allow SSRF bypasses.
//
// Fix: We updated isSafeWorkerUrl to perform robust IPv4 subnet parsing and checks
//   across all reserved ranges (loopback, private, carrier-grade NAT, benchmark, IPv6 local, etc.).

import { describe, it, expect } from "vitest";
import { isSafeWorkerUrl } from "@/lib/email";

describe("SEC-7 / SSRF: URL and IP range hardening", () => {
  it("allows safe, public HTTPS URLs", () => {
    expect(isSafeWorkerUrl("https://api.cloudflare.com/client/v4/send")).toBe(true);
    expect(isSafeWorkerUrl("https://my-worker.subdomain.workers.dev/send")).toBe(true);
    expect(isSafeWorkerUrl("https://example.com/api")).toBe(true);
    expect(isSafeWorkerUrl("https://1.1.1.1/send")).toBe(true); // Public DNS resolver IP
  });

  it("blocks non-HTTPS protocols", () => {
    expect(isSafeWorkerUrl("http://example.com")).toBe(false);
    expect(isSafeWorkerUrl("ftp://example.com")).toBe(false);
    expect(isSafeWorkerUrl("gopher://example.com")).toBe(false);
  });

  it("blocks local hostnames and .local domains", () => {
    expect(isSafeWorkerUrl("https://localhost/send")).toBe(false);
    expect(isSafeWorkerUrl("https://my-local-server.local/send")).toBe(false);
  });

  it("blocks loopback IPv4 ranges (127.0.0.0/8)", () => {
    expect(isSafeWorkerUrl("https://127.0.0.1/send")).toBe(false);
    expect(isSafeWorkerUrl("https://127.0.0.2/send")).toBe(false);
    expect(isSafeWorkerUrl("https://127.255.255.254/send")).toBe(false);
    expect(isSafeWorkerUrl("https://0.0.0.0/send")).toBe(false); // Local/broadcast range
  });

  it("blocks private IPv4 ranges (Class A, B, C)", () => {
    // 10.0.0.0/8
    expect(isSafeWorkerUrl("https://10.0.0.1/send")).toBe(false);
    expect(isSafeWorkerUrl("https://10.255.255.255/send")).toBe(false);

    // 172.16.0.0/12
    expect(isSafeWorkerUrl("https://172.16.0.1/send")).toBe(false);
    expect(isSafeWorkerUrl("https://172.31.255.254/send")).toBe(false);
    expect(isSafeWorkerUrl("https://172.15.255.255/send")).toBe(true); // Public
    expect(isSafeWorkerUrl("https://172.32.0.1/send")).toBe(true); // Public

    // 192.168.0.0/16
    expect(isSafeWorkerUrl("https://192.168.0.1/send")).toBe(false);
    expect(isSafeWorkerUrl("https://192.168.255.254/send")).toBe(false);
  });

  it("blocks link-local IPv4 (169.254.0.0/16)", () => {
    expect(isSafeWorkerUrl("https://169.254.169.254/send")).toBe(false);
    expect(isSafeWorkerUrl("https://169.254.0.1/send")).toBe(false);
  });

  it("blocks carrier-grade NAT (100.64.0.0/10)", () => {
    expect(isSafeWorkerUrl("https://100.64.0.1/send")).toBe(false);
    expect(isSafeWorkerUrl("https://100.127.255.255/send")).toBe(false);
    expect(isSafeWorkerUrl("https://100.63.255.255/send")).toBe(true); // Public
    expect(isSafeWorkerUrl("https://100.128.0.1/send")).toBe(true); // Public
  });

  it("blocks benchmark testing ranges (198.18.0.0/15)", () => {
    expect(isSafeWorkerUrl("https://198.18.0.1/send")).toBe(false);
    expect(isSafeWorkerUrl("https://198.19.255.255/send")).toBe(false);
    expect(isSafeWorkerUrl("https://198.17.255.255/send")).toBe(true); // Public
    expect(isSafeWorkerUrl("https://198.20.0.1/send")).toBe(true); // Public
  });

  it("blocks loopback and local IPv6", () => {
    expect(isSafeWorkerUrl("https://[::1]/send")).toBe(false);
    expect(isSafeWorkerUrl("https://[0:0:0:0:0:0:0:1]/send")).toBe(false);
    expect(isSafeWorkerUrl("https://[::]/send")).toBe(false);
  });

  it("blocks unique local (fc00::/7) and link-local (fe80::/10) IPv6", () => {
    expect(isSafeWorkerUrl("https://[fc00::1]/send")).toBe(false);
    expect(isSafeWorkerUrl("https://[fdff:ffff:ffff:ffff::1]/send")).toBe(false);
    expect(isSafeWorkerUrl("https://[fe80::1]/send")).toBe(false);
  });

  it("blocks IPv4-mapped private/loopback IPv6 addresses", () => {
    expect(isSafeWorkerUrl("https://[::ffff:127.0.0.1]/send")).toBe(false);
    expect(isSafeWorkerUrl("https://[::ffff:192.168.1.1]/send")).toBe(false);
  });
});
