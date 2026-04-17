import { memo, type Dispatch, type SetStateAction } from 'react';

export const HelpView = memo(function HelpView({
  visible,
  showDumbcubeHelp,
  setShowDumbcubeHelp,
}: {
  visible: boolean;
  showDumbcubeHelp: boolean;
  setShowDumbcubeHelp: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <div id="help" className={`help-panel shell-card ${visible ? '' : 'hidden'}`.trim()}>
      <div className="panel-header-row">
        <p id="help-title" className="panel-title">{showDumbcubeHelp ? 'DUMBCUBE HELP' : 'SMARTCUBE HELP'}</p>
        <p id="dumbcube-toggle" className="help-toggle-text">
          {showDumbcubeHelp ? (
            <>🛜 USING a smart cube?{' '}
              <button type="button" className="text-blue-500" onClick={() => setShowDumbcubeHelp(false)}>
                CLICK HERE
              </button>
            </>
          ) : (
            <>🛜 NOT using a smart cube?{' '}
              <button type="button" className="text-blue-500" onClick={() => setShowDumbcubeHelp(true)}>
                CLICK HERE
              </button>
            </>
          )}
        </p>
      </div>

      {!showDumbcubeHelp ? (
        <>
          <p className="section-title">To get started with Cubedex:</p>
          <div id="help-content-smartcube">
            <ul className="help-list">
              <li>🔗 Connect your smart cube by clicking the <strong>Connect</strong> button. For more details, refer to the <a href="https://gist.github.com/afedotov/52057533a8b27a0277598160c384ae71" target="_blank" rel="noreferrer">FAQ</a>.</li>
              <li>📜 Load an algorithm from the list or input your own in the input field using standard Rubik's cube notation. You can also input the algorithm by performing it on the cube.</li>
              <li>🟩 Ensure the cube is oriented with <strong>WHITE on top</strong> and <strong>GREEN on front</strong>.</li>
              <li>🏁 Click the <strong>▶️ Train</strong> button and turn the cube to start practicing the algorithm.</li>
              <li>🪄 If you want the smartcube to match the virtual cube, click the <strong>Scramble To...</strong> button and follow the scramble.</li>
            </ul>
            <p className="section-title">During training:</p>
            <ul className="help-list">
              <li>⏱️ The timer will start automatically when you begin the algorithm.</li>
              <li>🏆 Upon successful completion, the timer will stop and your last 5 times along with their average will be displayed.</li>
              <li>🔄 If you make a mistake, follow the moves shown in the <strong>Fix</strong> section to correct it. Ensure the top center is <strong>WHITE</strong> and the front center is <strong>GREEN</strong>.</li>
            </ul>
            <p className="section-title">Customize your practice drills:</p>
            <ul className="help-list">
              <li>📂 Pick a category, choose subsets, and select the cases you want to work on.</li>
              <li>🔖 Mark the algs you're learning or have already learned. You can use the <strong>Select Learning</strong> option to filter algs by learning status.</li>
              <li>🔀 Try <strong>Random AUF</strong> to practice with random orientations. For 2-sided recognition, turn off the Gyroscope Orientation and Mirror Sticker hints in Options, letting you view only two sides of the cube. For sets like PLL or ZBLL, you'll also get random post-AUFs to sharpen your AUF prediction.</li>
              <li>🎲 Enable <strong>Random Order</strong> to mix up the algorithms.</li>
              <li>🐌 Turn on <strong>Slow Cases First</strong> to improve these slow algorithms.</li>
              <li>🎯 Activate <strong>Prioritize Failed Cases</strong> to focus on the algorithms you find most challenging.</li>
              <li>📝 Want to change the algorithm for one or more cases? Click on the algorithm to edit it. You can also <strong>Export Algs</strong> in Options, modify the algorithm in the JSON file, then import it back.</li>
              <li>⏳ Training for PLL Time Attack? Create a new category and add all your PLL algorithms in sequence for a timed practice session.</li>
            </ul>
          </div>
        </>
      ) : (
        <div id="help-content-dumbcube">
          <ul className="help-list">
            <li>📜 Load an algorithm from the list or input your own in the input field using standard Rubik's cube notation.</li>
            <li>🏁 Press the spacebar (on computer) or touch the timer (on touchscreen enabled devices) to start and stop the timer.</li>
          </ul>
          <p className="section-title">During training:</p>
          <ul className="help-list">
            <li>🪄 If you want to setup the case on your cube, click the <strong>Scramble To...</strong> button and follow the scramble.</li>
            <li>🏆 When you stop the timer your last 5 times along with their average will be displayed.</li>
          </ul>
          <p className="section-title">Customize your practice drills:</p>
          <ul className="help-list">
            <li>📂 Pick a category, choose subsets, and select the cases you want to work on.</li>
            <li>🔖 Mark the algs you're learning or have already learned. You can use the <strong>Select Learning</strong> option to filter algs by learning status.</li>
            <li>🔀 Try <strong>Random AUF</strong> to practice with random orientations. For 2-sided recognition, turn off Mirror Sticker hints in Options, letting you view only two sides of the cube.</li>
            <li>🎲 Enable <strong>Random Order</strong> to mix up the algorithms.</li>
            <li>🐌 Turn on <strong>Slow Cases First</strong> to improve these slow algorithms.</li>
            <li>📝 Want to change the algorithm for one or more cases? Click on the algorithm to edit it. You can also <strong>Export Algs</strong> in Options, modify the algorithm in the JSON file, then import it back.</li>
            <li>⏳ Training for PLL Time Attack? Create a new category and add all your PLL algorithms in sequence for a timed practice session.</li>
          </ul>
        </div>
      )}

      <p className="section-title">Still need help? Watch the video tutorial:</p>
      <div className="video-shell">
        <div style={{ position: 'relative', overflow: 'hidden', width: '100%', paddingTop: '56.25%' }}>
          <iframe
            title="Cubedex Tutorial"
            loading="lazy"
            src="https://www.youtube.com/embed/AZcFMiT2Vm0"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allow="fullscreen; picture-in-picture"
          />
        </div>
      </div>

      <div className="help-footer-shell">
        <div id="help-footer" className="subpanel">
          <p className="centered-text"><strong>Love Cubedex? Help us grow! 🌱</strong></p>
          <p className="centered-text">No Ads here 🤗 Support the app's development on <a href="https://ko-fi.com/cubedex" target="_blank" rel="noreferrer">Ko-fi</a>:</p>
          <p className="centered-text"><a href="https://ko-fi.com/H2H6132Z3Z" target="_blank" rel="noreferrer">Support Me on Ko-fi</a></p>
        </div>
      </div>
    </div>
  );
});
