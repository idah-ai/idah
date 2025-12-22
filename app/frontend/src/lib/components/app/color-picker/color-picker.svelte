<script lang="ts">
  import { onMount } from "svelte";

  import InputField from "@/components/app/forms/fields/input/input-field.svelte";
  import SingleSelectField from "@/components/app/forms/fields/select/single/single-select-field.svelte";
  import Slider from "@/components/ui/slider/slider.svelte";

  import { cn } from "@/utils";

  import type { LabelValue } from "@/utils/types";

  // Props
  interface Props {
    value: string | null | undefined;
    class?: string | null;
  }

  let { value = $bindable(null), class: className }: Props = $props();

  // variables
  let hue = $state(0); // 0-360
  let saturation = $state(50); // 0-100
  let brightness = $state(60); // 0-100
  let opacity = $state(100); // 0-100

  let colorFormat = $state("HEX");
  let colorFormats: LabelValue<string>[] = [
    { label: "HEX", value: "HEX" },
    { label: "RGB", value: "RGB" },
    { label: "HSL", value: "HSL" },
  ];

  let canvas: HTMLCanvasElement;
  let ctx = $state<CanvasRenderingContext2D | null>(null);
  let isDraggingCanvas = $state(false);

  let canvasX = $derived(0);
  let canvasY = $derived(0);

  let rgb = $derived(hexToRgb(value));
  let hsv = $derived(rgbToHsv(rgb.r, rgb.g, rgb.b));

  // Derived color input based on selected format
  let colorInput = $derived.by(() => {
    const rgb = hsvToRgb(hue, saturation, brightness);

    if (colorFormat === "RGB") {
      const alpha = opacity / 100;

      return alpha < 1
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fixDecimal(alpha)})`
        : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    } else if (colorFormat === "HSL") {
      const alpha = opacity / 100;

      return alpha < 1
        ? `hsla(${fixDecimal(hue)}, ${fixDecimal(saturation)}%, ${fixDecimal(brightness)}%, ${fixDecimal(alpha)})`
        : `hsl(${fixDecimal(hue)}, ${fixDecimal(saturation)}%, ${fixDecimal(brightness)}%)`;
    } else {
      // HEX format
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    }
  });

  // functions
  function fixDecimal(value: number, decimals: number = 2): number {
    if (Number.isInteger(value)) {
      return value;
    }

    return Number(value.toFixed(decimals));
  }

  function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    s = s / 100;
    v = v / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r1 = 0,
      g1 = 0,
      b1 = 0;

    if (h >= 0 && h < 60) {
      r1 = c;
      g1 = x;
      b1 = 0;
    } else if (h >= 60 && h < 120) {
      r1 = x;
      g1 = c;
      b1 = 0;
    } else if (h >= 120 && h < 180) {
      r1 = 0;
      g1 = c;
      b1 = x;
    } else if (h >= 180 && h < 240) {
      r1 = 0;
      g1 = x;
      b1 = c;
    } else if (h >= 240 && h < 300) {
      r1 = x;
      g1 = 0;
      b1 = c;
    } else {
      r1 = c;
      g1 = 0;
      b1 = x;
    }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r = r / 255;
    g = g / 255;
    b = b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const v = max;

    if (delta !== 0) {
      s = delta / max;

      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
      } else if (max === g) {
        h = ((b - r) / delta + 2) * 60;
      } else {
        h = ((r - g) / delta + 4) * 60;
      }
    }

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
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }

  function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } {
    if (!hex) return { r: 0, g: 0, b: 0 };

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 123, g: 178, b: 162 };
  }

  // Update color values
  function updateFromHSV() {
    const rgb = hsvToRgb(hue, saturation, brightness);
    value = rgbToHex(rgb.r, rgb.g, rgb.b);
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
  function handleHueChange(value: number) {
    hue = value;
    updateFromHSV();
    drawCanvas();
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
      return;
    }

    // Try to parse RGB/RGBA format
    const rgbMatch = inputValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      const a = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1;

      if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        const hsv = rgbToHsv(r, g, b);
        hue = hsv.h;
        saturation = hsv.s;
        brightness = hsv.v;
        opacity = Math.round(a * 100);
        value = rgbToHex(r, g, b);
        drawCanvas();
        updateCanvasPosition();
      }
      return;
    }

    // Try to parse HSL/HSLA format
    const hslMatch = inputValue.match(/hsla?\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/i);
    if (hslMatch) {
      const h = parseFloat(hslMatch[1]);
      const s = parseFloat(hslMatch[2]);
      const l = parseFloat(hslMatch[3]);
      const a = hslMatch[4] ? parseFloat(hslMatch[4]) : 1;

      if (h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100) {
        hue = h;
        saturation = s;
        brightness = l;
        opacity = Math.round(a * 100);
        updateFromHSV();
        drawCanvas();
        updateCanvasPosition();
      }
    }
  }

  // Initialize
  onMount(() => {
    ctx = canvas.getContext("2d");

    // Parse initial value
    const initialValue = value || "#7BB2A2A";
    rgb = hexToRgb(initialValue);
    hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

    hue = hsv.h;
    saturation = hsv.s;
    brightness = hsv.v;

    drawCanvas();
    updateCanvasPosition();

    // Global mouse listeners for dragging
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingCanvas) handleCanvasMouseMove(e);
    };

    const handleGlobalMouseUp = () => {
      handleCanvasMouseUp();
    };

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
      width="700"
      height="660"
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
          onValueChange={handleHueChange}
        />
      </div>

      <!-- Opacity Slider -->
      <div class="slider-wrapper opacity-slider-wrapper">
        <div class="opacity-gradient"></div>
        <Slider bind:value={opacity} min={0} max={100} step={1} type="single" class="custom-slider" />
      </div>
    </div>
  </div>

  <!-- Input Row -->
  <div class="flex items-center gap-2">
    <SingleSelectField
      name="color-picker"
      label=""
      choices={colorFormats}
      value={colorFormat}
      onSelected={(selectedValue) => {
        colorFormat = selectedValue as string;
      }}
    ></SingleSelectField>

    <InputField name="color-picker/color" label="" value={colorInput} oninput={handleColorInputChange}></InputField>
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
