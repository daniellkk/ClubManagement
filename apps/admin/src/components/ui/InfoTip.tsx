import { Info } from "lucide-react";

/** Small ⓘ icon that reveals an explanation on hover/focus.
 *  Rendered as a span so it can live inside buttons and labels. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle ms-1.5">
      <span
        tabIndex={0}
        role="img"
        aria-label={text}
        className="rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-help"
      >
        <Info className="size-3.5" />
      </span>
      <span
        role="tooltip"
        // Physical left/translate so the bubble is centered on the icon in RTL and LTR alike
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
        <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gray-900" />
      </span>
    </span>
  );
}
