import { describe, expect, it } from "vitest";
import { PLANS, customerSchema, isValidCNPJ, isValidCPF, mapOrderStatus, maskPhone, offerMatchesPlan, phoneToE164 } from "@/lib/checkout-core";
import { verifyCaktoSignature } from "@/lib/cakto.server";

async function sign(secret: string, ts: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`)));
  return "v1=" + Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("checkout prices", () => {
  it("uses the advertised prices", () => {
    expect(PLANS.completo.price).toBe(24.9);
    expect(PLANS.especial.price).toBe(17.9);
    expect(PLANS.basico.price).toBe(10);
  });
  it("rejects an offer whose Cakto price differs", () => {
    expect(offerMatchesPlan({ status: "active", price: 24.9 }, "completo")).toBe(true);
    expect(offerMatchesPlan({ status: "active", price: 19.9 }, "completo")).toBe(false);
    expect(offerMatchesPlan({ status: "disabled", price: 24.9 }, "completo")).toBe(false);
  });
});

describe("customer validation", () => {
  it("validates CPF and CNPJ check digits", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-80")).toBe(false);
  });
  it("masks and converts a Brazilian mobile to E.164", () => {
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678");
    expect(phoneToE164("(11) 91234-5678")).toBe("5511912345678");
    expect(phoneToE164("(11) 3123-4567")).toBeNull();
  });
  it("requires full name", () => {
    expect(customerSchema.safeParse({ name: "Ana", email: "a@b.com", phone: "11912345678", doc: "52998224725" }).success).toBe(false);
  });
});

describe("payment status", () => {
  it("only 'paid' is approved", () => {
    expect(mapOrderStatus("paid")).toBe("approved");
    expect(mapOrderStatus("waiting_payment")).toBe("pending");
    expect(mapOrderStatus("authorized")).toBe("pending");
    expect(mapOrderStatus("refused")).toBe("refused");
  });
});

describe("webhook signature", () => {
  const body = '{"event":"purchase_approved","data":{"id":"x"}}';
  it("accepts a valid signature and rejects tampering or old timestamps", async () => {
    const now = 1_800_000_000, ts = String(now);
    const sig = await sign("s3cret", ts, body);
    expect(await verifyCaktoSignature(body, ts, sig, "s3cret", now)).toBe(true);
    expect(await verifyCaktoSignature(body + " ", ts, sig, "s3cret", now)).toBe(false);
    expect(await verifyCaktoSignature(body, ts, sig, "other", now)).toBe(false);
    expect(await verifyCaktoSignature(body, ts, sig, "s3cret", now + 301)).toBe(false);
  });
});

describe("order bumps", async () => {
  const { bumpLines, orderTotal, PLAN_INCLUDES } = await import("@/lib/checkout-core");
  it("charges R$24,90 for the complete offer without extras", () => {
    expect(orderTotal("completo", [])).toBe(24.9);
  });
  it("charges R$17,90 for the special offer without extras", () => {
    expect(orderTotal("especial", [])).toBe(17.9);
  });
  it("charges R$10 for the basic offer without extras", () => {
    expect(orderTotal("basico", [])).toBe(10);
  });
  it("adds bump prices to the plan", () => {
    expect(orderTotal("completo", ["zero"])).toBe(31.8);
    expect(orderTotal("basico", ["etiquetas", "precificadora"])).toBe(21.8);
  });
  it("all four bumps cost R$16,64", () => {
    expect(bumpLines(["zero", "etiquetas", "canva", "precificadora"]).total).toBe(16.64);
    expect(orderTotal("especial", ["zero", "etiquetas", "canva", "precificadora"])).toBe(34.54);
  });
  it("the R$10 plan includes no bonus", () => {
    expect(PLAN_INCLUDES.basico).toEqual([]);
  });
});
