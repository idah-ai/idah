import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommandManager from './CommandManager';
import { type Command } from './Command';

describe('CommandManager', () => {
  beforeEach(() => {
    // Reset CommandManager state before each test
    CommandManager.clear();

    // Mock Date.now for consistent testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty commands and currentIndex -1', () => {
    expect(CommandManager.commands).toEqual([]);
    expect(CommandManager.currentIndex).toBe(-1);
    expect(CommandManager.size()).toBe(0);
  });

  it('should add a command and execute it', () => {
    const mockApply = vi.fn();
    const mockCommand: Command = {
      apply: mockApply,
      undo: vi.fn(),
      name: 'Test Command',
      isCombinable: () => false,
      combine: () => mockCommand
    };

    CommandManager.add(mockCommand);

    expect(CommandManager.size()).toBe(1);
    expect(CommandManager.currentIndex).toBe(0);
    expect(mockApply).toHaveBeenCalledTimes(1);
  });

  it('should return the last command', () => {
    const mockCommand1: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command 1',
      isCombinable: () => false,
      combine: () => mockCommand1
    };

    const mockCommand2: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command 2',
      isCombinable: () => false,
      combine: () => mockCommand2
    };

    expect(CommandManager.lastCommand()).toBeNull();

    CommandManager.add(mockCommand1);
    expect(CommandManager.lastCommand()?.command).toBe(mockCommand1);

    CommandManager.add(mockCommand2);
    expect(CommandManager.lastCommand()?.command).toBe(mockCommand2);
  });

  it('should undo a command', () => {
    const mockUndo = vi.fn();
    const mockCommand: Command = {
      apply: vi.fn(),
      undo: mockUndo,
      name: 'Test Command',
      isCombinable: () => false,
      combine: () => mockCommand
    };

    CommandManager.add(mockCommand);
    CommandManager.undoOnce();

    expect(CommandManager.currentIndex).toBe(-1);
    expect(mockUndo).toHaveBeenCalledTimes(1);
  });

  it('should undo multiple commands', () => {
    const mockUndo1 = vi.fn();
    const mockUndo2 = vi.fn();
    const mockUndo3 = vi.fn();

    const mockCommand1: Command = {
      apply: vi.fn(),
      undo: mockUndo1,
      name: 'Test Command 1',
      isCombinable: () => false,
      combine: () => mockCommand1
    };

    const mockCommand2: Command = {
      apply: vi.fn(),
      undo: mockUndo2,
      name: 'Test Command 2',
      isCombinable: () => false,
      combine: () => mockCommand2
    };

    const mockCommand3: Command = {
      apply: vi.fn(),
      undo: mockUndo3,
      name: 'Test Command 3',
      isCombinable: () => false,
      combine: () => mockCommand3
    };

    CommandManager.add(mockCommand1);
    CommandManager.add(mockCommand2);
    CommandManager.add(mockCommand3);

    CommandManager.undo(2);

    expect(CommandManager.currentIndex).toBe(0);
    expect(mockUndo3).toHaveBeenCalledTimes(1);
    expect(mockUndo2).toHaveBeenCalledTimes(1);
    expect(mockUndo1).toHaveBeenCalledTimes(0);
  });

  it('should do nothing when trying to undo with no commands', () => {
    CommandManager.undoOnce();
    expect(CommandManager.currentIndex).toBe(-1);
  });

  it('should clear all commands', () => {
    const mockCommand: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command',
      isCombinable: () => false,
      combine: () => mockCommand
    };

    CommandManager.add(mockCommand);
    CommandManager.add(mockCommand);
    expect(CommandManager.size()).toBe(2);

    CommandManager.clear();
    expect(CommandManager.size()).toBe(0);
    expect(CommandManager.currentIndex).toBe(-1);
  });

  it('should combine commands if they are combinable and added within 5 seconds', () => {
    const mockApply1 = vi.fn();
    const mockApply2 = vi.fn();
    const mockCombinedApply = vi.fn();

    const mockCommand1: Command = {
      apply: mockApply1,
      undo: vi.fn(),
      name: 'Test Command 1',
      isCombinable: () => true,
      combine: () => mockCombinedCommand
    };

    const mockCommand2: Command = {
      apply: mockApply2,
      undo: vi.fn(),
      name: 'Test Command 2',
      isCombinable: () => true,
      combine: () => mockCombinedCommand
    };

    const mockCombinedCommand: Command = {
      apply: mockCombinedApply,
      undo: vi.fn(),
      name: 'Combined Command',
      isCombinable: () => false,
      combine: () => mockCombinedCommand
    };

    // Set up spies for the isCombinable and combine methods
    const isCombinable2Spy = vi.spyOn(mockCommand2, 'isCombinable');
    const combineSpy = vi.spyOn(mockCommand2, 'combine');

    // Add first command
    const now = new Date(2023, 0, 1, 12, 0, 0);
    vi.setSystemTime(now);
    CommandManager.add(mockCommand1);

    // Add second command within 5 seconds
    vi.setSystemTime(new Date(now.getTime() + 3000)); // 3 seconds later
    CommandManager.add(mockCommand2);

    // Verify that isCombinable was called with the first command
    expect(isCombinable2Spy).toHaveBeenCalledWith(mockCommand1);

    // Verify that combine was called with the first command
    expect(combineSpy).toHaveBeenCalledWith(mockCommand1);

    // Verify that the second command's apply was called
    expect(mockApply2).toHaveBeenCalledTimes(1);

    // Verify that we still have only one command in the stack (the combined one)
    expect(CommandManager.size()).toBe(1);
    expect(CommandManager.lastCommand()?.command).toBe(mockCombinedCommand);
  });

  it('should not combine commands if they are added more than 5 seconds apart', () => {
    const mockCommand1: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command 1',
      isCombinable: () => true,
      combine: vi.fn()
    };

    const mockCommand2: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command 2',
      isCombinable: vi.fn(),
      combine: vi.fn()
    };

    // Add first command
    const now = new Date(2023, 0, 1, 12, 0, 0);
    vi.setSystemTime(now);
    CommandManager.add(mockCommand1);

    // Add second command after 6 seconds
    vi.setSystemTime(new Date(now.getTime() + 6000)); // 6 seconds later
    CommandManager.add(mockCommand2);

    // Verify that isCombinable was not called
    expect(mockCommand2.isCombinable).not.toHaveBeenCalled();

    // Verify that we have two commands in the stack
    expect(CommandManager.size()).toBe(2);
  });

  it('should not combine commands if they are not combinable', () => {
    const mockCommand1: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command 1',
      isCombinable: () => false,
      combine: vi.fn()
    };

    const mockCommand2: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command 2',
      isCombinable: () => false,
      combine: vi.fn()
    };

    // Add first command
    const now = new Date(2023, 0, 1, 12, 0, 0);
    vi.setSystemTime(now);
    CommandManager.add(mockCommand1);

    // Add second command within 5 seconds
    vi.setSystemTime(new Date(now.getTime() + 3000)); // 3 seconds later
    CommandManager.add(mockCommand2);

    // Verify that we have two commands in the stack
    expect(CommandManager.size()).toBe(2);
  });

  it('should remove oldest commands when exceeding maxCommands', () => {
    const originalMaxCommands = CommandManager.maxCommands;
    CommandManager.maxCommands = 3; // Set a small limit for testing

    const mockCommand: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Test Command',
      isCombinable: () => false,
      combine: () => mockCommand
    };

    // Add more commands than the limit
    for (let i = 0; i < 5; i++) {
      CommandManager.add(mockCommand);
    }

    // Should only keep the most recent 3 commands
    expect(CommandManager.size()).toBe(3);
    expect(CommandManager.currentIndex).toBe(4);

    // Restore original maxCommands
    CommandManager.maxCommands = originalMaxCommands;
  });

  it('should truncate future commands when adding a new command after undoing', () => {
    const mockCommand1: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Command 1',
      isCombinable: () => false,
      combine: () => mockCommand1
    };

    const mockCommand2: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Command 2',
      isCombinable: () => false,
      combine: () => mockCommand2
    };

    const mockCommand3: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Command 3',
      isCombinable: () => false,
      combine: () => mockCommand3
    };

    // Add three commands
    CommandManager.add(mockCommand1);
    CommandManager.add(mockCommand2);
    CommandManager.add(mockCommand3);
    expect(CommandManager.size()).toBe(3);

    // Undo back to the first command
    CommandManager.undo(2);
    expect(CommandManager.currentIndex).toBe(0);

    // Add a new command
    const mockCommand4: Command = {
      apply: vi.fn(),
      undo: vi.fn(),
      name: 'Command 4',
      isCombinable: () => false,
      combine: () => mockCommand4
    };

    CommandManager.add(mockCommand4);

    // Should have truncated commands 2 and 3, and added command 4
    expect(CommandManager.size()).toBe(2);
    expect(CommandManager.commands[0].command).toBe(mockCommand1);
    expect(CommandManager.commands[1].command).toBe(mockCommand4);
    expect(CommandManager.currentIndex).toBe(1);
  });
});
