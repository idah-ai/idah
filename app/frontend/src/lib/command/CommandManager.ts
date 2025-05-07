import { type Command } from './Command';

type CommandEntry = {
  at: number;
  command: Command;
}

const CommandManager = {
  commands: [] as CommandEntry[],
  currentIndex: -1,
  maxCommands: 100,

  lastCommand() {
    if (this.currentIndex < 0) {
      return null;
    }

    return this.commands[this.currentIndex];
  },

  add(command: Command) {
    const now = new Date().getTime();

    if (this.currentIndex < this.commands.length - 1) {
      this.commands = this.commands.slice(0, this.currentIndex + 1);
    }

    const lastCommand = this.lastCommand();
    if(lastCommand) {
      const diff = now - lastCommand.at;
      if (diff < 5000) {
        // Try to combine commands if they are combinable:
        if (command.isCombinable(lastCommand.command)) {
          const combinedCommand = command.combine(lastCommand.command);
          // We run the command without the combined version, because it might be
          // Faster:
          command.apply();

          this.commands[this.currentIndex] = {
            at: now,
            command: combinedCommand
          };

          return;
        }
      }
    }

    // If we are at the max commands, remove the oldest command:
    if (this.commands.length >= this.maxCommands) {
      this.commands.shift();
    }

    const commandEntry = {
      at: now,
      command
    }

    command.apply();
    this.commands.push(commandEntry);
    this.currentIndex++;
  },

  undo(times : number = 1) {
    for (let i = 0; i < times; i++) { this.undoOnce(); }
  },

  undoOnce() {
    if (this.currentIndex < 0) { return; }

    const entry = this.commands[this.currentIndex];
    entry.command.undo();

    this.currentIndex--;
  },

  size(){
    return this.commands.length;
  },

  clear() {
    this.commands = [];
    this.currentIndex = -1;
  }
};

export default CommandManager;