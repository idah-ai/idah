import type { IdahDriverV2 } from "..";
import { register as registerExitModeCommand } from "./core_exit_mode";
import { register as registerPaletteCommand } from "./core_palette";
import { register as registerRedoCommand } from "./core_redo";
import { register as registerResetCommand } from "./core_reset";
import { register as registerRetryCommand } from "./core_retry";
import { register as registerUndoCommand } from "./core_undo";

const COMMANDS = [
  registerExitModeCommand,
  registerPaletteCommand,
  registerRedoCommand,
  registerResetCommand,
  registerRetryCommand,
  registerUndoCommand,
];

function register(driver: IdahDriverV2) {
  COMMANDS.forEach((registerCommand) => registerCommand(driver));
}

export {
  registerExitModeCommand,
  registerPaletteCommand,
  registerRedoCommand,
  registerResetCommand,
  registerRetryCommand,
  registerUndoCommand,
};
export default register;
