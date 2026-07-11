"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const DEFAULT_ITEM_HEIGHT = 220;
const OVERSCAN = 4;

/**
 * Lightweight virtualizer for long evidence card lists (no extra dependency).
 */
export function VirtualEvidenceList<T>({
  items,
  estimateHeight = DEFAULT_ITEM_HEIGHT,
  renderItem,
  className,
}: {
  items: T[];
  estimateHeight?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(640);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    setViewport(el.clientHeight);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const { start, end, offsetY, totalHeight } = useMemo(() => {
    const startIdx = Math.max(
      0,
      Math.floor(scrollTop / estimateHeight) - OVERSCAN,
    );
    const visible = Math.ceil(viewport / estimateHeight) + OVERSCAN * 2;
    const endIdx = Math.min(items.length, startIdx + visible);
    return {
      start: startIdx,
      end: endIdx,
      offsetY: startIdx * estimateHeight,
      totalHeight: items.length * estimateHeight,
    };
  }, [scrollTop, viewport, estimateHeight, items.length]);

  if (items.length <= 24) {
    return (
      <div className={className}>
        {items.map((item, i) => (
          <div key={i} className="mb-3">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    );
  }

  const slice = items.slice(start, end);

  return (
    <div ref={scrollerRef} className={className}>
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {slice.map((item, i) => (
            <div
              key={start + i}
              className="mb-3"
              style={{ minHeight: estimateHeight - 12 }}
            >
              {renderItem(item, start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
