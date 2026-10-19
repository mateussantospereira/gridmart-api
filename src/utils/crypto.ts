/** Comparação em tempo constante (evita vazar o segredo por timing). */
export const timingSafeEqual = (a: string, b: string): boolean => {
  const [x, y] = [new TextEncoder().encode(a), new TextEncoder().encode(b)];
  if (x.length !== y.length) return false;

  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
};
