import {
  battleStatKeys,
  getNatureByAlignment,
  type Nature,
} from "../data/natures";

export type NatureGridPosition = {
  upIndex: number;
  downIndex: number;
};

export function getNatureGridPosition(nature: Nature): NatureGridPosition {
  return {
    upIndex: Math.max(0, battleStatKeys.indexOf(nature.up)),
    downIndex: Math.max(0, battleStatKeys.indexOf(nature.down)),
  };
}

export function getNatureAtGridPosition(position: NatureGridPosition) {
  return getNatureByAlignment(
    battleStatKeys[position.upIndex],
    battleStatKeys[position.downIndex],
  );
}
