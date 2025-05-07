import { describe, it, expect, vi } from 'vitest';
import { KeyMapBuilder } from './KeyMapBuilder';

describe('KeyMapBuilder', () => {
  it('should create a key map with a single shortcut without modifiers', () => {
    const action = vi.fn();

    const keyMap = KeyMapBuilder((b) => {
      b.on(null, "A", action, "A Command", "Executes A command");
    });

    expect(keyMap).toHaveProperty("A");
    expect(keyMap["A"].action).toBe(action);
    expect(keyMap["A"].name).toBe("A Command");
    expect(keyMap["A"].description).toBe("Executes A command");
  });

  it('should create a key map with a single shortcut with modifiers', () => {
    const action = vi.fn();

    const keyMap = KeyMapBuilder((b) => {
      b.on([b.Shift, b.Ctrl], "A", action, "Ctrl+Shift+A Command", "Executes Ctrl+Shift+A command");
    });

    // Modifiers are sorted alphabetically for consistency
    expect(keyMap).toHaveProperty("Ctrl+Shift+A");
    expect(keyMap["Ctrl+Shift+A"].action).toBe(action);
    expect(keyMap["Ctrl+Shift+A"].name).toBe("Ctrl+Shift+A Command");
    expect(keyMap["Ctrl+Shift+A"].description).toBe("Executes Ctrl+Shift+A command");
  });

  it('should create a key map with multiple shortcuts', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();

    const keyMap = KeyMapBuilder((b) => {
      b.on([b.Shift, b.Ctrl], "A", action1, "Ctrl+Shift+A Command", "Executes Ctrl+Shift+A command");
      b.on(null, "B", action2, "B Command", "Executes B command");
    });

    expect(keyMap).toHaveProperty("Ctrl+Shift+A");
    expect(keyMap).toHaveProperty("B");
    expect(keyMap["Ctrl+Shift+A"].action).toBe(action1);
    expect(keyMap["B"].action).toBe(action2);
  });

  it('should allow custom names and descriptions', () => {
    const action = vi.fn();

    const keyMap = KeyMapBuilder((b) => {
      b.on([b.Shift], "A", action, "Custom Name", "Custom Description");
    });

    expect(keyMap).toHaveProperty("Shift+A");
    expect(keyMap["Shift+A"].name).toBe("Custom Name");
    expect(keyMap["Shift+A"].description).toBe("Custom Description");
  });

  it('should handle all modifier keys', () => {
    const action = vi.fn();

    const keyMap = KeyMapBuilder((b) => {
      b.on([b.Shift, b.Ctrl, b.Alt, b.Meta], "A", action, "All Modifiers", "Uses all modifier keys");
    });

    // Modifiers are sorted alphabetically for consistency
    expect(keyMap).toHaveProperty("Alt+Ctrl+Meta+Shift+A");
  });

  it('should allow chaining of on() calls', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();

    const keyMap = KeyMapBuilder((b) => {
      b.on([b.Shift], "A", action1, "Shift+A Command", "Executes Shift+A command")
       .on([b.Ctrl], "B", action2, "Ctrl+B Command", "Executes Ctrl+B command");
    });

    expect(keyMap).toHaveProperty("Shift+A");
    expect(keyMap).toHaveProperty("Ctrl+B");
  });
});
