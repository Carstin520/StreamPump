const readString = (value: string | undefined, fallback: string): string => value ?? fallback;

const readNumber = (value: string | undefined, fallback: number): number =>
  value === undefined ? fallback : Number(value);

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

const readCsv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export const env = {
  readBoolean,
  readCsv,
  readNumber,
  readString,
};
