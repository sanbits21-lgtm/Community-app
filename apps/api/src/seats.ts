import { Event, Registration } from './models';

/**
 * Seats are tracked in one counter on the event (`booked`) and taken with a SINGLE atomic update, so two people
 * clicking at the same instant cannot both pass a "is there room?" check and both get the last seat.
 * Pending payments hold their seats; rejected ones release them.
 */
export async function reserveSeats(eventId: unknown, n: number): Promise<boolean> {
  const taken = await Event.findOneAndUpdate(
    // No capacity = unlimited; otherwise the new total must still fit.
    { _id: eventId, $or: [{ capacity: null }, { $expr: { $lte: [{ $add: ['$booked', n] }, '$capacity'] } }] },
    { $inc: { booked: n } },
  );
  return taken !== null;
}

export async function releaseSeats(eventId: unknown, n: number): Promise<void> {
  await Event.updateOne({ _id: eventId }, { $inc: { booked: -n } });
}

export const spotsLeft = (e: { capacity?: number | null; booked?: number | null }): number | null =>
  e.capacity == null ? null : Math.max(0, e.capacity - (e.booked ?? 0));

/** Rebuilds every counter from the registrations themselves. Run at start-up so a counter can never stay wrong. */
export async function syncBookedCounts(): Promise<void> {
  const rows = await Registration.aggregate<{ _id: unknown; n: number }>([
    { $match: { status: { $ne: 'rejected' } } },
    { $group: { _id: '$event', n: { $sum: '$attendees' } } },
  ]);
  const totals = new Map(rows.map((r) => [String(r._id), r.n]));
  const events = await Event.find().select('_id booked').lean();
  const ops = events
    .filter((e) => (e.booked ?? 0) !== (totals.get(String(e._id)) ?? 0))
    .map((e) => ({ updateOne: { filter: { _id: e._id }, update: { $set: { booked: totals.get(String(e._id)) ?? 0 } } } }));
  if (ops.length) await Event.bulkWrite(ops);
}
