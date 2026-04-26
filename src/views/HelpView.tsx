import { memo, type Dispatch, type SetStateAction } from 'react';

function Section({ title, items }: {
  title: string;
  items: Array<{ icon: string; text: string }>;
}) {
  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{
        padding: '8px 14px',
        background: 'var(--raised)',
        borderBottom: '1px solid var(--border)',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--fg3)',
      }}>
        {title}
      </div>
      <ul style={{ margin: 0, padding: '8px 0', listStyle: 'none', background: 'var(--surface)' }}>
        {items.map((item, i) => (
          <li key={i} style={{
            display: 'flex',
            gap: 10,
            padding: '8px 14px',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--fg2)',
          }}>
            <span style={{ flexShrink: 0, fontSize: 15 }}>{item.icon}</span>
            <span dangerouslySetInnerHTML={{ __html: item.text }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const smartSections = [
  {
    title: 'Getting Started',
    items: [
      { icon: '🔗', text: 'Connect your smart cube by clicking the <strong>Connect</strong> button. See the <a href="https://gist.github.com/afedotov/52057533a8b27a0277598160c384ae71" target="_blank" rel="noreferrer" style="color:var(--accent)">FAQ</a> for more details.' },
      { icon: '📜', text: "Load an algorithm from the list or type your own using standard Rubik's cube notation. You can also input moves directly on the cube." },
      { icon: '🟩', text: 'Ensure the cube is oriented with <strong>WHITE on top</strong> and <strong>GREEN on front</strong>.' },
      { icon: '🏁', text: 'Click the <strong>▶ Train</strong> button and turn the cube to start practicing.' },
      { icon: '🪄', text: 'To match the virtual cube, click <strong>Scramble To…</strong> and follow the scramble.' },
    ],
  },
  {
    title: 'During Training',
    items: [
      { icon: '⏱️', text: 'The timer starts automatically when you begin the algorithm.' },
      { icon: '🏆', text: 'On success, the timer stops and your last 5 times with their average are shown.' },
      { icon: '🔄', text: 'If you make a mistake, follow the moves in the <strong>Fix</strong> section to correct it.' },
    ],
  },
  {
    title: 'Customise Your Drills',
    items: [
      { icon: '📂', text: 'Pick a category, choose subsets, and select the cases you want to work on.' },
      { icon: '🔖', text: 'Mark algs as Learning or Learned, or let <strong>Auto-update learning state</strong> manage it. Use <strong>Select Learning</strong> to filter by status.' },
      { icon: '🔀', text: 'Try <strong>Random AUF</strong> for random orientations. Disable Gyroscope & Mirror Stickers for 2-sided recognition practice.' },
      { icon: '🎲', text: 'Enable <strong>Random Order</strong> to mix up the algorithms.' },
      { icon: '🐌', text: 'Turn on <strong>Slow Cases First</strong> to focus on your slowest algorithms.' },
      { icon: '🧠', text: 'Enable <strong>Smart Order</strong> for Anki-style spaced repetition.' },
      { icon: '🎯', text: 'Activate <strong>Prioritize Failed Cases</strong> to focus on your hardest algorithms.' },
      { icon: '📝', text: 'Click any algorithm to edit it. Or use <strong>Export Algs</strong> in Options, edit the JSON, then re-import.' },
      { icon: '⏳', text: 'Turn on <strong>Time Attack</strong> to run all selected cases as one continuous session.' },
    ],
  },
];

const dumbSections = [
  {
    title: 'Getting Started',
    items: [
      { icon: '📜', text: "Load an algorithm from the list or type your own using standard Rubik's cube notation." },
      { icon: '🏁', text: 'Press <strong>Spacebar</strong> (desktop) or tap the timer (touchscreen) to start and stop the timer.' },
    ],
  },
  {
    title: 'During Training',
    items: [
      { icon: '🪄', text: 'Click <strong>Scramble To…</strong> to set up the case on your cube and follow the scramble.' },
      { icon: '🏆', text: 'When you stop the timer, your last 5 times and their average are shown.' },
    ],
  },
  {
    title: 'Customise Your Drills',
    items: [
      { icon: '📂', text: 'Pick a category, choose subsets, and select the cases you want to work on.' },
      { icon: '🔖', text: 'Mark algs as Learning or Learned, or let <strong>Auto-update learning state</strong> manage it.' },
      { icon: '🔀', text: 'Try <strong>Random AUF</strong> for random orientations. Disable Mirror Stickers in Options for 2-sided recognition.' },
      { icon: '🎲', text: 'Enable <strong>Random Order</strong> to mix up the algorithms.' },
      { icon: '🐌', text: 'Turn on <strong>Slow Cases First</strong> to focus on your slowest algorithms.' },
      { icon: '🧠', text: 'Enable <strong>Smart Order</strong> for Anki-style spaced repetition.' },
      { icon: '📝', text: 'Click any algorithm to edit it, or export/modify/re-import from Options.' },
      { icon: '⏳', text: 'Turn on <strong>Time Attack</strong> to run all selected cases as one continuous session.' },
    ],
  },
];

export const HelpView = memo(function HelpView({
  visible,
  showDumbcubeHelp,
  setShowDumbcubeHelp,
  isMobile,
}: {
  visible: boolean;
  showDumbcubeHelp: boolean;
  setShowDumbcubeHelp: Dispatch<SetStateAction<boolean>>;
  isMobile?: boolean;
}) {
  if (!visible) return null;

  const pad = isMobile ? 12 : 20;
  const pb = isMobile ? 'calc(var(--tab-h) + 12px)' : 16;
  const sections = showDumbcubeHelp ? dumbSections : smartSections;

  const pillBtn = (val: 'smart' | 'dumb', label: string) => {
    const active = val === 'smart' ? !showDumbcubeHelp : showDumbcubeHelp;
    return (
      <button
        key={val}
        type="button"
        onClick={() => setShowDumbcubeHelp(val === 'dumb')}
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s',
          background: active ? 'var(--accent)' : 'transparent',
          color: active ? '#fff' : 'var(--fg3)',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="app-view-fade-in"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${isMobile ? 14 : 18}px ${pad}px`,
        paddingBottom: pb,
      }}
    >
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header + mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          {!isMobile && (
            <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0, color: 'var(--fg)' }}>Help</h2>
          )}
          <div style={{ display: 'flex', background: 'var(--raised)', borderRadius: 8, padding: 2, gap: 1 }}>
            {pillBtn('smart', '🛜 Smartcube')}
            {pillBtn('dumb', '⌨️ Regular Cube')}
          </div>
        </div>

        {/* Content sections */}
        {sections.map((s) => <Section key={s.title} title={s.title} items={s.items} />)}

        {/* Video tutorial */}
        <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{
            padding: '8px 14px',
            background: 'var(--raised)',
            borderBottom: '1px solid var(--border)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--fg3)',
          }}>
            Video Tutorial
          </div>
          <div style={{ padding: 14, background: 'var(--surface)' }}>
            <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 6, overflow: 'hidden', background: 'var(--bg)' }}>
              <iframe
                title="Cubedex Tutorial"
                loading="lazy"
                src="https://www.youtube.com/embed/AZcFMiT2Vm0"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                allow="fullscreen; picture-in-picture"
              />
            </div>
          </div>
        </div>

        {/* Support */}
        <div style={{
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'center',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>Love Cubedex? Help us grow! 🌱</span>
          <span style={{ fontSize: 13, color: 'var(--fg3)' }}>No ads here 🤗 — support the app's development:</span>
          <a
            href="https://ko-fi.com/H2H6132Z3Z"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 4,
              padding: '7px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
              boxShadow: '0 4px 10px rgba(59,130,246,0.35)',
            }}
          >
            ☕ Support on Ko-fi
          </a>
        </div>

      </div>
    </div>
  );
});
