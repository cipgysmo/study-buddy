export interface Sm2State {
  ease: number;
  interval: number;
  reps: number;
}

export interface Sm2Result extends Sm2State {
  dueISO: string;
}

/**
 * Classic SM-2 spaced-repetition step.
 * @param quality recall quality, 0-5 (0-2 = failure, 3-5 = success)
 */
export function sm2(state: Sm2State, quality: number, todayISO: string): Sm2Result {
  let { ease, interval, reps } = state;
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ease);
    reps += 1;
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const due = new Date(todayISO + "T00:00:00Z");
  due.setUTCDate(due.getUTCDate() + interval);

  return { ease, interval, reps, dueISO: due.toISOString().slice(0, 10) };
}
