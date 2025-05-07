
/**
 * Represents a command that can be executed and undone.
 * It also provides methods to check if it can be combined with another command.
 *
 * For example, if we have a command to fill certains pixels, and the previous command
 * was also a fill command, we can combine them into one command. On undo, we will
 * undo both commands at once.
 */
export type Command = {
  apply: () => void;
  undo: () => void;

  name : string; // A human readable name for the command, used for showing in the UI.
  isCombinable: (previousCommand : Command) => boolean;
  combine: (previousCommand : Command) => Command;
}