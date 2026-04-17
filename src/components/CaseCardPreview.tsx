import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  getPreview,
  previewKey,
  requestPreview,
  subscribePreview,
  type Preview,
} from '../lib/preview-cache';

interface Props {
  alg: string;
  visualization: string;
  stickering: string;
  setupAnchor?: 'start' | 'end';
  sizePx?: number;
}

export function CaseCardPreview({
  alg,
  visualization,
  stickering,
  setupAnchor = 'end',
  sizePx = 240,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const key = previewKey({ alg, visualization, stickering, setupAnchor });
  const [preview, setPreview] = useState<Preview | undefined>(() => getPreview(key));

  // Reset cached preview when key changes.
  useEffect(() => {
    setPreview(getPreview(key));
    const unsubscribe = subscribePreview(key, () => {
      setPreview(getPreview(key));
    });
    return unsubscribe;
  }, [key]);

  // Visibility gating via IntersectionObserver.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    // If layout settles after mount (common during category switches), the initial rect
    // check can be wrong. Re-check on the next frame and on scroll/resize until visible.
    // This keeps the "only appears after scrolling" case from happening.
    let rafId: number | null = null;
    const marginY = 200;
    let settleChecks = 0;
    const maxSettleChecks = 3;
    const promoteIfInRange = (_reason: string) => {
      const r = el.getBoundingClientRect();
      const inRange = r.bottom >= -marginY && r.top <= window.innerHeight + marginY;
      if (inRange) {
        setVisible(true);
      }
    };
    const scheduleSettleCheck = (reason: string) => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        settleChecks += 1;
        promoteIfInRange(reason);
        if (settleChecks < maxSettleChecks) {
          scheduleSettleCheck(`${reason}->next-frame`);
        }
      });
    };
    scheduleSettleCheck('raf-after-mount');
    const onScrollOrResize = () => {
      scheduleSettleCheck('scroll-or-resize');
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return () => {
        window.removeEventListener('scroll', onScrollOrResize);
        window.removeEventListener('resize', onScrollOrResize);
        if (rafId != null) window.cancelAnimationFrame(rafId);
      };
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { rootMargin: '200px 0px' },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Kick off a request when visible and no cached preview.
  useEffect(() => {
    if (!visible) return;
    if (getPreview(key)) return;
    void requestPreview({ alg, visualization, stickering, setupAnchor });
  }, [visible, key, alg, visualization, stickering, setupAnchor]);

  const wrapperStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const innerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    maxWidth: `${sizePx}px`,
    maxHeight: `${sizePx}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div ref={hostRef} style={wrapperStyle} className="twisty-case-host">
      {preview?.src ? (
        <img
          src={preview.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ ...innerStyle, objectFit: 'contain' }}
        />
      ) : (
        <div style={innerStyle} />
      )}
    </div>
  );
}
