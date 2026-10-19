export const pluralizeUnit = (value: number, unit: string, units?: string) => {
  return value > 1 ? `${units || unit + "s"}` : unit;
};
