import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CaseCardData } from '../lib/case-cards';
import { CaseCard } from '../components/CaseCard';
import { EmptyState } from '../components/ui/EmptyState';

function VirtualizedCaseGrid({ cards }: { cards: CaseCardData[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const containerTopRef = useRef<number>(0);
  const [viewport, setViewport] = useState<{ scrollY: number; vh: number; width: number }>({
    scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
    vh: typeof window !== 'undefined' ? window.innerHeight : 0,
    width: 0,
  });

  function measureContainerTop() {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    containerTopRef.current = rect.top + window.scrollY;
  }

  useLayoutEffect(() => {
    measureContainerTop();
  }, [viewport.width, cards.length]);

  useEffect(() => {
    function scheduleUpdate() {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        measureContainerTop();
        setViewport((v) => ({
          ...v,
          scrollY: window.scrollY,
          vh: window.innerHeight,
        }));
      });
    }

    function onScrollOrResize() {
      scheduleUpdate();
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    onScrollOrResize();
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

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

  const containerTop = containerTopRef.current;
  const viewTop = viewport.scrollY;
  const viewBottom = viewport.scrollY + viewport.vh;
  const startRow = Math.min(
    totalRows - 1,
    Math.max(0, Math.floor((viewTop - containerTop) / rowHeight) - overscanRows),
  );
  const endRow = Math.min(
    totalRows - 1,
    Math.max(startRow, Math.ceil((viewBottom - containerTop) / rowHeight) + overscanRows),
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
          description="Pick a category, adjust filters, or import algorithms from Options."
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

