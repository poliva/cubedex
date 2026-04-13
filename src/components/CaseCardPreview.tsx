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
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
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
    return () => obs.disconnect();
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
      {preview && preview.kind === 'svg' && preview.markup ? (
        <div
          style={{ ...innerStyle, overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: preview.markup }}
        />
      ) : preview && preview.kind === 'image' && preview.src ? (
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
