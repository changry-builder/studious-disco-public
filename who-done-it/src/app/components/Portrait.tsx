import { initials } from "../text";

export function Portrait({ name, large }: { name: string; large?: boolean }) {
  return (
    <span className={large ? "portrait portrait--lg" : "portrait"} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
