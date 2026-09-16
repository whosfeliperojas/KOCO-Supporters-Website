"use client";

import { useLocale } from "@/lib/locale-context";
import { EVENT_APPROVAL_LABEL } from "@/lib/i18n";
import type { EventApproval } from "@/lib/types";

/**
 * An event's approval state, in the same colours a content post's state uses -
 * see lib/status-colors.ts. Both admins and volunteers render this one, so an
 * event that reads "approved" on the admin tab reads the same, in the same
 * teal, on the volunteer tab.
 *
 * A confirmed event is the resting state of every event that is actually
 * happening, so it renders no chip by default: on a list where almost
 * everything is confirmed, a teal chip on every row says nothing. Pass
 * `always` where the state is the point rather than the exception - a
 * volunteer looking at the proposal they submitted wants to see "approved"
 * spelled out.
 */
export default function EventStatusChip({
  status,
  always = false,
}: {
  status: EventApproval | string;
  always?: boolean;
}) {
  const { locale } = useLocale();
  const s = status as EventApproval;
  const label = EVENT_APPROVAL_LABEL[s];
  if (!label) return null;
  if (s === "confirmed" && !always) return null;

  return (
    <span className={`chip-${s} label-style px-2 py-0.5 rounded-full text-xs whitespace-nowrap`}>
      {label[locale]}
    </span>
  );
}
