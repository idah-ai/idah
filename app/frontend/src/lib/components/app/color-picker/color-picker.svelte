<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import Slider from "@/components/ui/slider/slider.svelte";

  import { cn } from "@/utils";

  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props {
    value: string | null | undefined;
    class?: string | null;
    slotSuggestion?: Snippet;
    onValueChange?: (value: string | null | undefined) => void;
    showOpacitySlider?: boolean;
  }

  let {
    value = $bindable(null),
    class: className,
    slotSuggestion,
    onValueChange,
    showOpacitySlider = false,
  }: Props = $props();

  // Variables
  let colorFormat = $derived("hex");
  let colorFormats: LabelValue<string>[] = [
    { label: "HEX", value: "hex" },
    { label: "RGB", value: "rgb" },
    { label: "HSL", value: "hsl" },
  ];

  let canvas: HTMLCanvasElement;
  let ctx = $state<CanvasRenderingContext2D | null>(null);
  let isDraggingCanvas = $state(false);

  let canvasX = $state(0);
  let canvasY = $state(0);

  // Parse external value and derive color state from it
  let colorState = $derived.by(() => {
    if (!value) return { hue: 0, saturation: 0, brightness: 0, opacity: 100 };

    const format = detectColorFormat(value);
    let state;

    switch (format) {
      case "rgb":
        state = initFromRgb(value);
        break;
      case "hsl":
        state = initFromHsl(value);
        break;
      case "hex":
        state = initFromHex(value);
        break;
      default:
        state = initFromHex(value);
        break;
    }

    if (ctx) {
      queueMicrotask(() => {
        drawCanvas();
        updateCanvasPosition();
      });
    }

    return state || { hue: 0, saturation: 0, brightness: 0, opacity: 100 };
  });

  // Color state derived from external value
  let opacity = $derived(colorState.opacity);
  let hue = $derived(colorState.hue);
  let saturation = $derived(colorState.saturation);
  let brightness = $derived(colorState.brightness);

  // Derived color input based on selected format
  let colorInput = $derived.by(() => {
    const thisRgb = hsvToRgb(hue, saturation, brightness);
    return formatColor({ rgbValue: thisRgb });
  });

  // Functions
  function formatColor(props: { rgbValue: { r: number; g: number; b: number } }): string {
    const { rgbValue } = props;
    const alpha = opacity / 100;

    switch (colorFormat) {
      case "rgb":
        return alpha < 1
          ? `rgba(${rgbValue.r}, ${rgbValue.g}, ${rgbValue.b}, ${fixDecimal(alpha)})`
          : `rgb(${rgbValue.r}, ${rgbValue.g}, ${rgbValue.b})`;

      case "hsl": {
        const hsl = rgbToHsl(rgbValue.r, rgbValue.g, rgbValue.b);

        return alpha < 1
          ? `hsla(${fixDecimal(hsl.h)}, ${fixDecimal(hsl.s)}%, ${fixDecimal(hsl.l)}%, ${fixDecimal(alpha)})`
          : `hsl(${fixDecimal(hsl.h)}, ${fixDecimal(hsl.s)}%, ${fixDecimal(hsl.l)}%)`;
      }

      default:
        // HEX format
        return rgbToHex(rgbValue.r, rgbValue.g, rgbValue.b);
    }
  }

  function fixDecimal(value: number, decimals: number = 2): number {
    if (Number.isInteger(value)) {
      return value;
    }

    return Number(value.toFixed(decimals));
  }

  function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    // normalize
    h = ((h % 360) + 360) % 360;
    s = Math.min(Math.max(s, 0), 100) / 100;
    v = Math.min(Math.max(v, 0), 100) / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r1 = 0,
      g1 = 0,
      b1 = 0;

    const sector = Math.floor(h / 60);

    switch (sector) {
      case 0: // 0–59
        r1 = c;
        g1 = x;
        b1 = 0;
        break;

      case 1: // 60–119
        r1 = x;
        g1 = c;
        b1 = 0;
        break;

      case 2: // 120–179
        r1 = 0;
        g1 = c;
        b1 = x;
        break;

      case 3: // 180–239
        r1 = 0;
        g1 = x;
        b1 = c;
        break;

      case 4: // 240–299
        r1 = x;
        g1 = 0;
        b1 = c;
        break;

      default: // 300–359
        r1 = c;
        g1 = 0;
        b1 = x;
        break;
    }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const v = max;

    if (delta !== 0) {
      switch (max) {
        case r:
          h = ((g - b) / delta) % 6;
          break;

        case g:
          h = (b - r) / delta + 2;
          break;

        case b:
          h = (r - g) / delta + 4;
          break;
      }

      h *= 60;
    }

    if (max !== 0) {
      s = delta / max;
    }

    h = (h + 360) % 360;

    return {
      h: Math.round(h),
      s: Math.round(s * 100),
      v: Math.round(v * 100),
    };
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return (
      "#" +
      [r, g, b]
        .map((x) => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }

  function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } {
    if (!hex) return { r: 0, g: 0, b: 0 };

    let cleaned = hex.replace("#", "");

    if (cleaned.length === 3) {
      cleaned = cleaned
        .split("")
        .map((c) => c + c)
        .join("");
    }

    if (cleaned.length !== 6) {
      return { r: 0, g: 0, b: 0 };
    }

    const num = parseInt(cleaned, 16);

    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));

      switch (max) {
        case r:
          h = ((g - b) / delta) % 6;
          break;
        case g:
          h = (b - r) / delta + 2;
          break;
        case b:
          h = (r - g) / delta + 4;
          break;
      }

      h *= 60;
    }

    h = (h + 360) % 360;

    return {
      h: Math.round(h),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    // normalize
    h = ((h % 360) + 360) % 360;
    s = Math.min(Math.max(s, 0), 100) / 100;
    l = Math.min(Math.max(l, 0), 100) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r1 = 0,
      g1 = 0,
      b1 = 0;

    const sector = Math.floor(h / 60);

    switch (sector) {
      case 0: // 0–59
        r1 = c;
        g1 = x;
        b1 = 0;
        break;

      case 1: // 60–119
        r1 = x;
        g1 = c;
        b1 = 0;
        break;

      case 2: // 120–179
        r1 = 0;
        g1 = c;
        b1 = x;
        break;

      case 3: // 180–239
        r1 = 0;
        g1 = x;
        b1 = c;
        break;

      case 4: // 240–299
        r1 = x;
        g1 = 0;
        b1 = c;
        break;

      default: // 300–359
        r1 = c;
        g1 = 0;
        b1 = x;
        break;
    }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  // Detect the format of a color string
  function detectColorFormat(colorString: string | null | undefined): "hex" | "rgb" | "hsl" {
    if (!colorString) return "hex";

    const trimmed = colorString.trim();

    // Check for RGB/RGBA
    if (/^rgba?\(/i.test(trimmed)) {
      return "rgb";
    }

    // Check for HSL/HSLA
    if (/^hsla?\(/i.test(trimmed)) {
      return "hsl";
    }

    // Default to HEX
    return "hex";
  }

  // Update color values
  function updateFromHSV() {
    const rgb = hsvToRgb(hue, saturation, brightness);
    value = formatColor({ rgbValue: rgb });
    onValueChange?.(colorInput);
  }

  // Draw the saturation/brightness canvas
  function drawCanvas() {
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Get the pure hue color
    const hueColor = hsvToRgb(hue, 100, 100);

    // Create gradient from white to hue color (left to right)
    const horizontalGradient = ctx.createLinearGradient(0, 0, width, 0);
    horizontalGradient.addColorStop(0, "#FFFFFF");
    horizontalGradient.addColorStop(1, `rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b})`);

    ctx.fillStyle = horizontalGradient;
    ctx.fillRect(0, 0, width, height);

    // Create gradient from transparent to black (top to bottom)
    const verticalGradient = ctx.createLinearGradient(0, 0, 0, height);
    verticalGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    verticalGradient.addColorStop(1, "#000000");

    ctx.fillStyle = verticalGradient;
    ctx.fillRect(0, 0, width, height);
  }

  // Handle canvas click/drag
  function handleCanvasMouseDown(e: MouseEvent) {
    isDraggingCanvas = true;
    updateCanvasColor(e);
  }

  function handleCanvasMouseMove(e: MouseEvent) {
    updateCanvasColor(e);
  }

  function handleCanvasMouseUp() {
    isDraggingCanvas = false;
  }

  function updateCanvasColor(e: MouseEvent) {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    // Update cursor position (in pixels relative to displayed canvas)
    canvasX = x;
    canvasY = y;

    // Calculate saturation and brightness percentages
    saturation = (x / rect.width) * 100;
    brightness = 100 - (y / rect.height) * 100;

    updateFromHSV();
  }

  function updateCanvasPosition() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvasX = (saturation / 100) * rect.width;
    canvasY = ((100 - brightness) / 100) * rect.height;
  }

  // Handle hue changes from slider
  function handleColorChange(value: number) {
    hue = value;
    updateFromHSV();
    drawCanvas();
  }

  // Handle opacity changes from slider
  function handleOpacityChange(value: number) {
    opacity = value;
    updateFromHSV();
  }

  function applyParsedColor(parsed: { hue: number; saturation: number; brightness: number; opacity: number }) {
    hue = parsed.hue;
    saturation = parsed.saturation;
    brightness = parsed.brightness;
    opacity = parsed.opacity;

    updateFromHSV();
    drawCanvas();
    updateCanvasPosition();
  }

  // Handle color input changes
  function handleColorInputChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const inputValue = input.value.trim();

    // Try to parse HEX format
    if (/^#?[0-9A-F]{6}$/i.test(inputValue)) {
      const hexValue = inputValue.startsWith("#") ? inputValue : `#${inputValue}`;
      const rgb = hexToRgb(hexValue);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

      hue = hsv.h;
      saturation = hsv.s;
      brightness = hsv.v;
      value = hexValue.toUpperCase();
      drawCanvas();
      updateCanvasPosition();
      onValueChange?.(colorInput);
      return;
    }

    const rgbParsed = initFromRgb(inputValue);
    if (rgbParsed) {
      applyParsedColor(rgbParsed);
      const rgb = rgbParsed.rgb;
      value = rgbToHex(Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b));
      return;
    }

    // ---- HSL / HSLA ----
    const hslParsed = initFromHsl(inputValue);
    if (hslParsed) {
      applyParsedColor(hslParsed);
      return;
    }
  }

  function initFromRgb(value: string) {
    const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);

    if (!m) return null;

    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);

    const opacity = m[4] ? Math.round(parseFloat(m[4]) * 100) : 100;

    const hsv = rgbToHsv(r, g, b);

    return {
      hue: hsv.h,
      saturation: hsv.s,
      brightness: hsv.v,
      opacity,
      rgb: { r, g, b },
    };
  }

  function initFromHsl(value: string) {
    const m = value.match(/hsla?\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/i);

    if (!m) return null;

    const h = parseFloat(m[1]);
    const s = parseFloat(m[2]);
    const l = parseFloat(m[3]);

    const rgb = hslToRgb(h, s, l);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

    return {
      hue: hsv.h,
      saturation: hsv.s,
      brightness: hsv.v,
      opacity: m[4] ? Math.round(parseFloat(m[4]) * 100) : 100,
    };
  }

  function initFromHex(value: string) {
    const rgb = hexToRgb(value);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

    return {
      hue: hsv.h,
      saturation: hsv.s,
      brightness: hsv.v,
      opacity: 100,
    };
  }

  // Initialize
  onMount(() => {
    ctx = canvas.getContext("2d");

    const initialValue = value || "#FFFFFF";
    colorFormat = detectColorFormat(initialValue);

    let state;

    switch (colorFormat) {
      case "rgb":
        state = initFromRgb(initialValue);
        break;

      case "hsl":
        state = initFromHsl(initialValue);
        break;

      case "hex":
        state = initFromHex(initialValue);
        break;

      default:
        state = initFromHex(initialValue);
        break;
    }

    if (state) {
      hue = state.hue;
      saturation = state.saturation;
      brightness = state.brightness;
      opacity = state.opacity;
    }

    drawCanvas();
    updateCanvasPosition();

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingCanvas) handleCanvasMouseMove(e);
    };

    const handleGlobalMouseUp = () => handleCanvasMouseUp();

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  });
</script>

<div class={cn("rounded-xl p-5", className)}>
  <!-- Saturation/Brightness Canvas -->
  <div class="relative mb-5 cursor-crosshair overflow-hidden rounded-2xl">
    <canvas
      bind:this={canvas}
      width="280"
      height="160"
      onmousedown={handleCanvasMouseDown}
      class="block h-auto w-full rounded-2xl"
    ></canvas>

    <!-- Cursor -->
    <div
      class="
      pointer-events-none
      absolute
      h-[24px] w-[24px]
      -translate-x-1/2 -translate-y-1/2
      rounded-full
      border-[4px] border-white
      shadow-[0_0_0_1px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(0,0,0,0.3)]
    "
      style="left: {canvasX}px; top: {canvasY}px;"
    ></div>
  </div>

  <!-- Sliders Row -->
  <div class="sliders-row">
    <div class="sliders">
      <!-- Hue Slider -->
      <div class="slider-wrapper hue-slider-wrapper">
        <div class="hue-gradient"></div>
        <Slider
          value={hue}
          min={0}
          max={360}
          step={1}
          type="single"
          class="custom-slider"
          onValueChange={handleColorChange}
        />
      </div>

      <!-- Opacity Slider -->
      {#if showOpacitySlider}
        <div class="slider-wrapper opacity-slider-wrapper">
          <div class="opacity-gradient"></div>
          <Slider
            bind:value={opacity}
            min={0}
            max={100}
            step={1}
            type="single"
            class="custom-slider"
            onValueChange={handleOpacityChange}
          />
        </div>
      {/if}
    </div>
  </div>

  <!-- Input Row -->
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <SingleSelectField
        name="color-picker"
        label=""
        choices={colorFormats}
        value={colorFormat}
        onSelected={(selectedValue) => {
          colorFormat = selectedValue as string;
          onValueChange?.(colorInput);
        }}
      ></SingleSelectField>

      <InputField name="color-picker/color" label="" value={colorInput} oninput={handleColorInputChange}></InputField>
    </div>

    {#if slotSuggestion}
      {@render slotSuggestion()}
    {/if}
  </div>
</div>

<style>
  .sliders-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  .sliders-row::-webkit-scrollbar {
    height: 6px;
  }

  .sliders-row::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  .sliders-row::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 3px;
  }

  .sliders-row::-webkit-scrollbar-thumb:hover {
    background: #999;
  }

  .sliders {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .slider-wrapper {
    position: relative;
    height: 20px;
  }

  .hue-gradient,
  .opacity-gradient {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 10px;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  }

  .hue-gradient {
    background: linear-gradient(
      to right,
      #ff0000 0%,
      #ffff00 17%,
      #00ff00 33%,
      #00ffff 50%,
      #0000ff 67%,
      #ff00ff 83%,
      #ff0000 100%
    );
  }

  .opacity-gradient {
    background: linear-gradient(to right, #e0e0e0 0%, #606060 100%);
  }

  .slider-wrapper :global(.custom-slider) {
    position: absolute;
    top: 0;
    width: 100%;
  }

  .slider-wrapper :global([data-slot="slider-track"]) {
    background: transparent !important;
    height: 20px;
  }

  .slider-wrapper :global([data-slot="slider-range"]) {
    display: none;
  }

  .slider-wrapper :global([data-slot="slider-thumb"]) {
    width: 24px;
    height: 24px;
    border: 4px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    background: transparent;
  }
</style>
