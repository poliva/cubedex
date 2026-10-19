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

**2×2 recovery:** Undo recent turns to return to the last correct algorithm
position. “Help me recover” reads the current stickers, asks you to rotate the
whole cube to match a fixed picture, and demonstrates one U/R/F correction at a
time. An unexpected turn updates the picture and asks for alignment again. The
same timed attempt continues throughout recovery.

2×2 progress uses device facelet snapshots because GAN 251 UI and MoYu MY22 axis
codes alone cannot reliably represent opposite-face turns. Reads may add latency;
a failed read offers retry without assuming the cube is solved. Physical grip is
confirmed by the user, independently of gyroscope orientation.

This workspace uses the sibling `../smartcube-web-bluetooth` package for device
snapshot metadata. Build that package before installing/building Cubedex:

```sh
(cd ../smartcube-web-bluetooth && npm install && npm run build)
```

**Building:**
```
$ npm install
$ npm run build && npm run preview
```
