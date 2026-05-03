export const exhaustiveSwitch = <TValue extends string, TReturn>(
  value: TValue,
  cases: { [K in TValue]: () => TReturn },
): TReturn => {
  const handler = cases[value];
  if (handler) {
    return handler();
  }

  throw new Error(`Unhandled case: ${value}`);
};
