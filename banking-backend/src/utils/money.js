export function toPaise(amount) {
  // Ensure numeric, round to avoid fp errors
  const n = Number(amount);
  if (Number.isNaN(n)) throw new Error('Invalid amount');
  return Math.round(n * 100);
}

export function fromPaise(paise) {
  return (paise / 100);
}
