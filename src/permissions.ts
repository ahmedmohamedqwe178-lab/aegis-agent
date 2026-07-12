// نظام الأذونات — على مستوى الجلسة (يوافق مرة واحدة على الفئة)

import { randomUUID } from "node:crypto";
import type { AgentEvent } from "./types.js";

type WaitEntry = {
  resolve: (granted: boolean) => void;
  category: string;
  tool: string;
};

export class PermissionManager {
  // فئات موافق عليها لهذه الجلسة
  private sessionApproved = new Set<string>();
  private sessionDenied = new Set<string>();
  // طلبات معلقة في انتظار رد المستخدم
  private pending = new Map<string, WaitEntry>();

  // القرار من المستخدم يصل هنا
  resolvePending(id: string, granted: boolean, applyToSession = true) {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    if (applyToSession) {
      if (granted) this.sessionApproved.add(entry.category);
      else this.sessionDenied.add(entry.category);
    }
    entry.resolve(granted);
  }

  // يستدعى من الأدوات: يعيد promise ينتظر إذن المستخدم
  async request(
    tool: string,
    category: string,
    args: any,
    description: string,
    emit: (e: AgentEvent) => void,
    danger: "safe" | "moderate" | "dangerous",
  ): Promise<boolean> {
    // العمليات الآمنة لا تحتاج إذن
    if (danger === "safe") return true;

    // إذا كانت الفئة موافق عليها لهذه الجلسة
    if (this.sessionApproved.has(category)) return true;
    if (this.sessionDenied.has(category)) return false;

    // إرسال طلب إذن للواجهة
    const id = randomUUID();
    return new Promise<boolean>((resolve) => {
      this.pending.set(id, { resolve, category, tool });
      emit({
        type: "permission_request",
        data: { id, tool, category, args, description },
      });
    });
  }

  reset() {
    this.sessionApproved.clear();
    this.sessionDenied.clear();
    for (const entry of this.pending.values()) entry.resolve(false);
    this.pending.clear();
  }

  getState() {
    return {
      approved: Array.from(this.sessionApproved),
      denied: Array.from(this.sessionDenied),
      pending: this.pending.size,
    };
  }
}
