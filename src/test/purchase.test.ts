import { describe, expect, it } from "vitest";
import { buildPurchaseEvent } from "@/lib/tracking/core";

const ctx = { user_data: { fbp: "fb.1.1.1" }, nowSec: 1_800_000_000 };
describe("server Purchase", () => {
  it("is built only for a paid Cakto order, with Cakto's amount in BRL and a stable id", () => {
    const e = buildPurchaseEvent({ id: "o1", status: "paid", amount: "34.80" }, ctx);
    expect(e?.event_id).toBe("purchase_o1");
    expect(e?.custom_data).toMatchObject({ currency: "BRL", value: 34.8, order_id: "o1" });
    expect(buildPurchaseEvent({ id: "o1", status: "paid", amount: "34.80" }, ctx)?.event_id).toBe(e?.event_id);
  });
  it("is never built for unpaid orders or missing amounts", () => {
    expect(buildPurchaseEvent({ id: "o1", status: "waiting_payment", amount: 24.9 }, ctx)).toBeNull();
    expect(buildPurchaseEvent({ id: "o1", status: "paid", amount: null }, ctx)).toBeNull();
    expect(buildPurchaseEvent({ id: "o1", status: "paid", amount: "0" }, ctx)).toBeNull();
  });
});
