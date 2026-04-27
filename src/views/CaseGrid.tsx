import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CaseCardData } from '../lib/case-cards';
import { CaseCard } from '../components/CaseCard';
import { EmptyState } from '../components/ui/EmptyState';

function findVerticalScrollParent(el: HTMLElement | null): HTMLElement | null {
  let n = el?.parentElement ?? null;
  while (n) {
    const st = getComputedStyle(n);
    const oy = st.overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
      return n;
    }
    n = n.parentElement;
  }
  return null;
}

function VirtualizedCaseGrid({ cards }: { cards: CaseCardData[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState<{
    width: number;
    /** Viewport Y of visible clip top (scroll parent top or 0). */
    clipTop: number;
    /** Viewport Y of visible clip bottom. */
    clipBottom: number;
    /** Viewport Y of virtualized container top. */
    containerTop: number;
  }>({
    width: 0,
    clipTop: 0,
    clipBottom: typeof window !== 'undefined' ? window.innerHeight : 0,
    containerTop: 0,
  });

  function measureVisibleSlice() {
    const el = containerRef.current;
    if (!el) return;
    const cr = el.getBoundingClientRect();
    const S = scrollParentRef.current;
    let clipTop = 0;
    let clipBottom = window.innerHeight;
    if (S) {
      const pr = S.getBoundingClientRect();
      clipTop = pr.top;
      clipBottom = pr.bottom;
    }
    setViewport((v) => ({
      ...v,
      clipTop,
      clipBottom,
      containerTop: cr.top,
    }));
  }

  function scheduleMeasure() {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      measureVisibleSlice();
    });
  }

  useLayoutEffect(() => {
    scrollParentRef.current = findVerticalScrollParent(containerRef.current);
    measureVisibleSlice();
  }, [viewport.width, cards.length]);

  useEffect(() => {
    function onScrollOrResize() {
      scheduleMeasure();
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize);
    const el = containerRef.current;
    const S = findVerticalScrollParent(el);
    scrollParentRef.current = S;
    if (S) {
      S.addEventListener('scroll', onScrollOrResize, { passive: true });
    }
    scheduleMeasure();
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      if (S) {
        S.removeEventListener('scroll', onScrollOrResize);
      }
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cards.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setViewport((v) => (v.width === nextWidth ? v : { ...v, width: nextWidth }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gap = 16;
  // Keep in sync with `.case-wrapper` padding + inner content height.
  // Virtualization needs a fixed height; too small causes bottom clipping (toggle flush to card bottom).
  const itemHeight = 300;
  const overscanRows = 4;
  const cols = Math.max(1, Math.floor((viewport.width + gap) / (260 + gap)));
  const itemWidth = cols > 0 ? Math.max(220, Math.floor((viewport.width - gap * (cols - 1)) / cols)) : 220;
  const rowHeight = itemHeight + gap;
  const totalRows = Math.ceil(cards.length / cols);
  const totalHeight = Math.max(0, totalRows * rowHeight - gap);

  if (totalRows === 0) {
    return <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '0px' }} />;
  }

  const { clipTop, clipBottom, containerTop } = viewport;
  const startRow = Math.min(
    totalRows - 1,
    Math.max(0, Math.floor((clipTop - containerTop) / rowHeight) - overscanRows),
  );
  const endRow = Math.min(
    totalRows - 1,
    Math.max(startRow, Math.ceil((clipBottom - containerTop) / rowHeight) + overscanRows),
  );
  const startIndex = Math.max(0, startRow * cols);
  const endIndexExclusive = Math.min(cards.length, (endRow + 1) * cols);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: `${totalHeight}px` }}>
      {cards.slice(startIndex, endIndexExclusive).map((card, i) => {
        const absoluteIndex = startIndex + i;
        const row = Math.floor(absoluteIndex / cols);
        const col = absoluteIndex % cols;
        const top = row * rowHeight;
        const left = col * (itemWidth + gap);
        return (
          <CaseCard
            key={`${card.id}-${card.name}`}
            card={card}
            index={absoluteIndex}
            style={{
              position: 'absolute',
              top,
              left,
              width: itemWidth,
              height: itemHeight,
            }}
          />
        );
      })}
    </div>
  );
}

function CaseGridComponent({
  caseCards,
}: {
  caseCards: CaseCardData[];
}) {
  if (caseCards.length === 0) {
    return (
      <div
        id="alg-cases"
        className="alg-cases-grid alg-cases-empty"
      >
        <EmptyState
          title="No cases to show"
          description="Pick a category, choose a subset or adjust filters."
          data-testid="case-grid-empty"
        />
      </div>
    );
  }

  if (caseCards.length > 10) {
    return (
      <div id="alg-cases" className="alg-cases-virtualized">
        <VirtualizedCaseGrid cards={caseCards} />
      </div>
    );
  }

  return (
    <div id="alg-cases" className="alg-cases-grid">
      {caseCards.map((card, index) => (
        <CaseCard key={`${card.id}-${card.name}`} card={card} index={index} />
      ))}
    </div>
  );
}

export const CaseGrid = memo(CaseGridComponent);

