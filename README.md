## Cubedex 
[Cubedex](https://cubedex.app) is an alg trainer that helps you drill, time, and master Rubik's Cube algorithm sets like OLL and PLL, building them into your muscle memory more quickly and effectively.

📱 How to Get Started:  

✅ Visit [CubeDex.app](https://cubedex.app) in your browser  
✅ Add Cubedex to your home screen for an app-like experience  
✅ You can use it offline - Cubedex works perfectly without an internet connection  
✅ Compatible with smartcubes and regular non-Bluetooth cubes!  

📺 Watch the Tutorial Video:  
[![Watch the Tutorial Video](https://img.youtube.com/vi/AZcFMiT2Vm0/hqdefault.jpg)](https://www.youtube.com/watch?v=AZcFMiT2Vm0)  

Cubedex has been created with ♥ by [Pau Oliva Fora](https://twitter.com/pof) using [smartcube-web-bluetooth](https://github.com/poliva/smartcube-web-bluetooth) and [cubing.js](https://github.com/cubing/cubing.js).  

If you enjoy using Cubedex, please consider supporting the development on [Ko-fi](https://ko-fi.com/cubedex).  
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H6132Z3Z)

**Building:**
```
$ npm install
$ npm run build && npm run preview
```
**Testing:**

Every test has a unique ID in the format `[prefix-N]` (e.g. `[reg-3]`, `[vis-ext-42]`).

```bash
# Run all tests
npx playwright test

# Run a specific file
npx playwright test tests/visualisation.spec.ts

# Run regression tests only (quick validation of various things)
npx playwright test tests/regression.spec.ts

# Run a single test by ID
npx playwright test -g "[reg-3]"

# Run a multiple tests by ID
npx playwright test -g "[reg-3]|[reg-6]"

# Run all tests in a group by prefix
npx playwright test -g "alg-comp"
```
| Prefix | Test file | Description |
|--------|--------|--------|
| `reg` | regression | Quick retesting of important behaviors |
| `alg-comp` | alg-completion | Algorithm completion detection and flow |
| `vis-basic` | vis-basic | Basic visualization: forward, undo, wrong, double moves |
| `vis-wide` | vis-wide | Wide move (d', u, f, r, l) and rotation (y, x, z) visualization |
| `vis-slice` | vis-slice | Slice move (S, M, E, M2) visualization |
| `vis-crot` | vis-crot | Color rotation (Rotate Colors feature) visualization |
| `vis-mrm` | vis-mrm | masterRepairFaceMap cross-algorithm orientation visualization |
| `vis-complex` | vis-complex | Complex multi-step scenarios, encapsulated algs, bug repros |
| `move` | move-handling | Move matching logic (pattern detection, undo, override) |
| `mrf` | master-repair-facemap | masterRepairFaceMap state tracking (non-vis) |
| `split` | split-alg-cursor | Split algorithm cursor positioning |
| `stick-cd` | stickering-countdown | Stickering masks and countdown behavior |
| `btn-lay` | button-layout | Button layout and visibility |
| `ui` | ui-elements | UI element existence, visibility, defaults, search bar |
| `opt` | options-persistence | Options/settings persistence across reloads |
| `opt-settings` | options-settings | Every setting: toggle/input/select stores, persists, no clobber |
| `smoke` | smoke | Basic page load and connectivity |

**Publish gh-page:**
```
$ rm -rf docs && mv dist docs
```
