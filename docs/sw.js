if(!self.define){let s,e={};const n=(n,i)=>(n=new URL(n+".js",i).href,e[n]||new Promise((e=>{if("document"in self){const s=document.createElement("script");s.src=n,s.onload=e,document.head.appendChild(s)}else s=n,importScripts(n),e()})).then((()=>{let s=e[n];if(!s)throw new Error(`Module ${n} didn’t register its module`);return s})));self.define=(i,r)=>{const l=s||("document"in self?document.currentScript.src:"")||location.href;if(e[l])return;let a={};const o=s=>n(s,l),u={module:{uri:l},exports:a,require:o};e[l]=Promise.all(i.map((s=>u[s]||o(s)))).then((s=>(r(...s),a)))}}define(["./workbox-b994f779"],(function(s){"use strict";self.skipWaiting(),s.clientsClaim(),s.precacheAndRoute([{url:"apple-touch-icon.png",revision:"a77bcff80bf32b4d148439bbfc0f4116"},{url:"assets/chunk-Y3BVWVFU-DmYehmMA.js",revision:null},{url:"assets/index-76LUJ1LQ.css",revision:null},{url:"assets/index-C3cwAN6R.js",revision:null},{url:"assets/index-DmeWs1Mn.js",revision:null},{url:"assets/inside-Y2UVJZNJ-Bpg_WYG8.js",revision:null},{url:"assets/puzzles-dynamic-3x3x3-JWIWLLZA-fR7zXD4k.js",revision:null},{url:"assets/puzzles-dynamic-4x4x4-REUXFQJ4-BNnOy5ao.js",revision:null},{url:"assets/puzzles-dynamic-megaminx-2LVHIDL4-Cm8jQJ-N.js",revision:null},{url:"assets/puzzles-dynamic-side-events-QIADTLKJ-Ce2s_gCL.js",revision:null},{url:"assets/puzzles-dynamic-unofficial-NCMLO2AJ-SUsTto0f.js",revision:null},{url:"assets/search-dynamic-sgs-side-events-RPVZU2YB-Cn01H5xH.js",revision:null},{url:"assets/search-dynamic-sgs-unofficial-2TYKOUM4-CsuS_ipM.js",revision:null},{url:"assets/search-dynamic-solve-3x3x3-QHRLSVAC-6iYVGW9D.js",revision:null},{url:"assets/search-dynamic-solve-4x4x4-V5D7RQND-DxsGckzd.js",revision:null},{url:"assets/search-dynamic-solve-fto-UOKDYVD5-DBNG5toQ.js",revision:null},{url:"assets/search-dynamic-solve-kilominx-RAZM75GA-CnyVv7Df.js",revision:null},{url:"assets/search-dynamic-solve-master_tetraminx-3D4MBF3V-DDfEUWlP.js",revision:null},{url:"assets/search-dynamic-solve-sq1-YESVPPLF-BCjQ508T.js",revision:null},{url:"assets/search-worker-entry-CJMUVv3g.js",revision:null},{url:"assets/search-worker-entry-DNPX3OpU.js",revision:null},{url:"assets/twisty-dynamic-3d-HF7KVBOE-YvGmnpjp.js",revision:null},{url:"assets/twsearch_wasm_bg-V4F3SIUO-QGKWKUFY-iE1VAZwZ.js",revision:null},{url:"assets/twsearch-MRZGOB6T-CzghMuW0.js",revision:null},{url:"assets/worker/chunk-Y3BVWVFU-BDrNbgoW.js",revision:null},{url:"assets/worker/index-OaN7RAFO.js",revision:null},{url:"assets/worker/inside-Y2UVJZNJ-Cu-MpFSH.js",revision:null},{url:"assets/worker/puzzles-dynamic-3x3x3-JWIWLLZA-fR7zXD4k.js",revision:null},{url:"assets/worker/puzzles-dynamic-4x4x4-REUXFQJ4-BNnOy5ao.js",revision:null},{url:"assets/worker/puzzles-dynamic-megaminx-2LVHIDL4-Cm8jQJ-N.js",revision:null},{url:"assets/worker/puzzles-dynamic-side-events-QIADTLKJ-Ce2s_gCL.js",revision:null},{url:"assets/worker/puzzles-dynamic-unofficial-NCMLO2AJ-SUsTto0f.js",revision:null},{url:"assets/worker/search-dynamic-sgs-side-events-RPVZU2YB-Q9KJhA9l.js",revision:null},{url:"assets/worker/search-dynamic-sgs-unofficial-2TYKOUM4-BWCqth6N.js",revision:null},{url:"assets/worker/search-dynamic-solve-3x3x3-QHRLSVAC-6iYVGW9D.js",revision:null},{url:"assets/worker/search-dynamic-solve-4x4x4-V5D7RQND-COf66azC.js",revision:null},{url:"assets/worker/search-dynamic-solve-fto-UOKDYVD5-BtkD8cfr.js",revision:null},{url:"assets/worker/search-dynamic-solve-kilominx-RAZM75GA-CspQUh7h.js",revision:null},{url:"assets/worker/search-dynamic-solve-master_tetraminx-3D4MBF3V-ERSDM-8s.js",revision:null},{url:"assets/worker/search-dynamic-solve-sq1-YESVPPLF-3E-Bmagu.js",revision:null},{url:"assets/worker/search-worker-entry-DcOSGEhO.js",revision:null},{url:"assets/worker/twsearch_wasm_bg-V4F3SIUO-QGKWKUFY-iE1VAZwZ.js",revision:null},{url:"assets/worker/twsearch-MRZGOB6T-CwgnijHO.js",revision:null},{url:"favicon-16x16.png",revision:"8b7823854aa1482006cd6f00249e7cb3"},{url:"favicon-32x32.png",revision:"ea765888fc25d763db5a8d9166d5e829"},{url:"icons/cubedex_screenshot_narrow.png",revision:"954ed691aee441143ca62f259bc7d50d"},{url:"icons/cubedex_screenshot_wide.png",revision:"a98d425dc2adfdfa483469199a0c82f3"},{url:"icons/icon-1024x1024.png",revision:"55af0d8811e233740d5199205aa38d8d"},{url:"icons/icon-192x192.png",revision:"51896a13572959eceae08a3e3b4ae555"},{url:"icons/icon-512x512.png",revision:"934ed52e28426f50d7a88654bb045a4d"},{url:"index.html",revision:"79bd57bb5c7f54380679b850fb9ccd5c"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"icons/icon-192x192.png",revision:"51896a13572959eceae08a3e3b4ae555"},{url:"icons/icon-512x512.png",revision:"934ed52e28426f50d7a88654bb045a4d"},{url:"manifest.json",revision:"4a1549d8d4dc1a0f10f015c15d10e1e7"}],{}),s.cleanupOutdatedCaches(),s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("index.html"))),s.registerRoute(/^https:\/\/cubedex\.app\/.*\.(png|jpg|svg)$/,new s.CacheFirst({cacheName:"images-cache",plugins:[new s.ExpirationPlugin({maxEntries:10,maxAgeSeconds:2592e3})]}),"GET")}));
