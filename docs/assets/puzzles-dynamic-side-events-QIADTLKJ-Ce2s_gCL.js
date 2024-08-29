var a=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN"
       "http://www.w3.org/TR/2001/REC-SVG-20050904/DTD/svg11.dtd">
    <svg width="288px" height="288px" viewBox="-16 -16 288 288" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
       <title>2x2x2 LL</title>
  <defs>
    <g id="sticker">
        <rect x="0" y="0" width="1" height="1" stroke="black" stroke-width="0.04px" />
    </g>
  </defs>
  <g id="2x2x2-LL" stroke="#000000" stroke-width="4" style="none" stroke-linejoin="round">
    <rect    id="CORNERS-l0-o0" style="fill: white" x="128" y="128" width="76" height="76"></rect>
    <polygon id="CORNERS-l0-o1" style="fill: red" points="204 128 252 128 252 252 204 204"></polygon>
    <polygon id="CORNERS-l0-o2" style="fill: limegreen" transform="translate(206, 238) scale(1, -1) rotate(-90) translate(-206, -238) " points="172 160 220 160 220 284 172 236"></polygon>
    <rect    id="CORNERS-l1-o0" style="fill: white" x="128" y="52" width="76" height="76"></rect>
    <polygon id="CORNERS-l1-o1" style="fill: #26f" transform="translate(206, 18) rotate(-90) translate(-206, -18) " points="172 -60 220 -60 220 64 172 16"></polygon>
    <polygon id="CORNERS-l1-o2" style="fill: red" transform="translate(238, 50) scale(1, -1) translate(-238, -50) " points="204 -28 252 -28 252 96 204 48"></polygon>
    <rect    id="CORNERS-l2-o0" style="fill: white" x="52" y="52" width="76" height="76"></rect>
    <polygon id="CORNERS-l2-o1" style="fill: orange" transform="translate(18, 50) scale(-1, -1) translate(-18, -50) " points="-16 -28 32 -28 32 96 -16 48"></polygon>
    <polygon id="CORNERS-l2-o2" style="fill: #26f" transform="translate(50, 18) scale(1, -1) rotate(90) translate(-50, -18) " points="16 -60 64 -60 64 64 16 16"></polygon>
    <rect    id="CORNERS-l3-o0" style="fill: white" x="52" y="128" width="76" height="76"></rect>
    <polygon id="CORNERS-l3-o1" style="fill: limegreen" transform="translate(50, 238) rotate(90) translate(-50, -238) " points="16 160 64 160 64 284 16 236"></polygon>
    <polygon id="CORNERS-l3-o2" style="fill: orange" transform="translate(18, 206) scale(-1, 1) translate(-18, -206) " points="-16 128 32 128 32 252 -16 204"></polygon>
  </g>
  <g style="opacity: 0">
    <use id="CORNERS-l4-o0" href="#sticker" style="fill: yellow"/>
    <use id="CORNERS-l4-o1" href="#sticker" style="fill: limegreen"/>
    <use id="CORNERS-l4-o2" href="#sticker" style="fill: red"/>

    <use id="CORNERS-l5-o0" href="#sticker" style="fill: yellow"/>
    <use id="CORNERS-l5-o1" href="#sticker" style="fill: orange"/>
    <use id="CORNERS-l5-o2" href="#sticker" style="fill: limegreen"/>

    <use id="CORNERS-l6-o0" href="#sticker" style="fill: yellow"/>
    <use id="CORNERS-l6-o1" href="#sticker" style="fill: #26f"/>
    <use id="CORNERS-l6-o2" href="#sticker"  style="fill: orange"/>

    <use id="CORNERS-l7-o0" href="#sticker" style="fill: yellow"/>
    <use id="CORNERS-l7-o1" href="#sticker" style="fill: red"/>
    <use id="CORNERS-l7-o2" href="#sticker" style="fill: #26f"/>
  </g>
</svg>`,n={name:"2x2x2",orbits:[{orbitName:"CORNERS",numPieces:8,numOrientations:3}],defaultPattern:{CORNERS:{pieces:[0,1,2,3,4,5,6,7],orientation:[0,0,0,0,0,0,0,0]}},moves:{U:{CORNERS:{permutation:[1,2,3,0,4,5,6,7],orientationDelta:[0,0,0,0,0,0,0,0]}},x:{CORNERS:{permutation:[4,0,3,5,7,6,2,1],orientationDelta:[2,1,2,1,1,2,1,2]}},y:{CORNERS:{permutation:[1,2,3,0,7,4,5,6],orientationDelta:[0,0,0,0,0,0,0,0]}}},derivedMoves:{z:"[x: y]",L:"[z: U]",F:"[x: U]",R:"[z': U]",B:"[x': U]",D:"[x2: U]",Uv:"y",Lv:"x'",Fv:"z",Rv:"x",Bv:"z'",Dv:"y'"}},f=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN"
       "http://www.w3.org/TR/2001/REC-SVG-20050904/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 530 394" preserveAspectRatio="xMidYMid meet">
  <title>2x2x2</title>
  <defs>
    <g id="sticker">
        <rect x="0" y="0" width="1" height="1" stroke="black" stroke-width="0.04px" />
    </g>
  </defs>
  <g id="puzzle" transform="translate(5, 5) scale(60)">
    <use id="CORNERS-l0-o0" href="#sticker" transform="translate(3.2, 1)" style="fill: white"/>
    <use id="CORNERS-l0-o1" href="#sticker" transform="translate(4.4, 2.2)" style="fill: red"/>
    <use id="CORNERS-l0-o2" href="#sticker" transform="translate(3.2, 2.2)" style="fill: limegreen"/>

    <use id="CORNERS-l1-o0" href="#sticker" transform="translate(3.2, 0)" style="fill: white"/>
    <use id="CORNERS-l1-o1" href="#sticker" transform="translate(6.6, 2.2)" style="fill: #26f"/>
    <use id="CORNERS-l1-o2" href="#sticker" transform="translate(5.4, 2.2)" style="fill: red"/>

    <use id="CORNERS-l2-o0" href="#sticker" transform="translate(2.2, 0)" style="fill: white"/>
    <use id="CORNERS-l2-o1" href="#sticker" transform="translate(0, 2.2)" style="fill: orange"/>
    <use id="CORNERS-l2-o2" href="#sticker" transform="translate(7.6, 2.2)" style="fill: #26f"/>

    <use id="CORNERS-l3-o0" href="#sticker" transform="translate(2.2, 1)" style="fill: white"/>
    <use id="CORNERS-l3-o1" href="#sticker" transform="translate(2.2, 2.2)" style="fill: limegreen"/>
    <use id="CORNERS-l3-o2" href="#sticker" transform="translate(1, 2.2)" style="fill: orange"/>

    <use id="CORNERS-l4-o0" href="#sticker" transform="translate(3.2, 4.4)" style="fill: yellow"/>
    <use id="CORNERS-l4-o1" href="#sticker" transform="translate(3.2, 3.2)" style="fill: limegreen"/>
    <use id="CORNERS-l4-o2" href="#sticker" transform="translate(4.4, 3.2)" style="fill: red"/>

    <use id="CORNERS-l5-o0" href="#sticker" transform="translate(2.2, 4.4)" style="fill: yellow"/>
    <use id="CORNERS-l5-o1" href="#sticker" transform="translate(1, 3.2)" style="fill: orange"/>
    <use id="CORNERS-l5-o2" href="#sticker" transform="translate(2.2, 3.2)" style="fill: limegreen"/>

    <use id="CORNERS-l6-o0" href="#sticker" transform="translate(2.2, 5.4)" style="fill: yellow"/>
    <use id="CORNERS-l6-o1" href="#sticker" transform="translate(7.6, 3.2)" style="fill: #26f"/>
    <use id="CORNERS-l6-o2" href="#sticker" transform="translate(0, 3.2)"  style="fill: orange"/>

    <use id="CORNERS-l7-o0" href="#sticker" transform="translate(3.2, 5.4)" style="fill: yellow"/>
    <use id="CORNERS-l7-o1" href="#sticker" transform="translate(5.4, 3.2)" style="fill: red"/>
    <use id="CORNERS-l7-o2" href="#sticker" transform="translate(6.6, 3.2)" style="fill: #26f"/>
  </g>

</svg>`,e=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],t=new Array(18).fill(0),o={permutation:e,orientationDelta:t},d={name:"clock",orbits:[{orbitName:"DIALS",numPieces:18,numOrientations:12},{orbitName:"FACES",numPieces:18,numOrientations:1},{orbitName:"FRAME",numPieces:1,numOrientations:2},{orbitName:"HOUR_MARKS",numPieces:18,numOrientations:4},{orbitName:"PEG_CAPS",numPieces:8,numOrientations:12}],defaultPattern:{DIALS:{pieces:e,orientation:t},FACES:{pieces:e,orientation:t},FRAME:{pieces:[0],orientation:[0]},HOUR_MARKS:{pieces:e,orientation:t},PEG_CAPS:{pieces:[0,1,2,3,4,5,6,7],orientation:[0,0,0,0,0,0,0,0]}},moves:{UL_PLUS_:{DIALS:{permutation:e,orientationDelta:[1,1,0,1,1,0,0,0,0,0,0,11,0,0,0,0,0,0]},FACES:o,FRAME:{permutation:[0],orientationDelta:[0]},HOUR_MARKS:o,PEG_CAPS:{permutation:[0,1,2,3,4,5,6,7],orientationDelta:[1,0,0,0,0,0,0,0]}},U_PLUS_:{DIALS:{permutation:e,orientationDelta:[1,1,1,1,1,1,0,0,0,11,0,11,0,0,0,0,0,0]},FACES:o,FRAME:{permutation:[0],orientationDelta:[0]},HOUR_MARKS:o,PEG_CAPS:{permutation:[0,1,2,3,4,5,6,7],orientationDelta:[1,1,0,0,0,0,0,0]}},ALL_PLUS_:{DIALS:{permutation:e,orientationDelta:[1,1,1,1,1,1,1,1,1,11,0,11,0,0,0,11,0,11]},FACES:o,FRAME:{permutation:[0],orientationDelta:[0]},HOUR_MARKS:o,PEG_CAPS:{permutation:[0,1,2,3,4,5,6,7],orientationDelta:[1,1,1,1,0,0,0,0]}},y2:{DIALS:{permutation:[9,10,11,12,13,14,15,16,17,0,1,2,3,4,5,6,7,8],orientationDelta:t},FACES:{permutation:[9,10,11,12,13,14,15,16,17,0,1,2,3,4,5,6,7,8],orientationDelta:t},FRAME:{permutation:[0],orientationDelta:[1]},HOUR_MARKS:{permutation:[9,10,11,12,13,14,15,16,17,0,1,2,3,4,5,6,7,8],orientationDelta:t},PEG_CAPS:{permutation:[4,5,6,7,0,1,2,3],orientationDelta:[0,0,0,0,0,0,0,0]}},z:{DIALS:{permutation:[6,3,0,7,4,1,8,5,2,11,14,17,10,13,16,9,12,15],orientationDelta:[3,3,3,3,3,3,3,3,3,-3,-3,-3,-3,-3,-3,-3,-3,-3]},FACES:{permutation:[6,3,0,7,4,1,8,5,2,11,14,17,10,13,16,9,12,15],orientationDelta:t},FRAME:{permutation:[0],orientationDelta:[0]},HOUR_MARKS:{permutation:[6,3,0,7,4,1,8,5,2,11,14,17,10,13,16,9,12,15],orientationDelta:[1,1,1,1,1,1,1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1]},PEG_CAPS:{permutation:[3,0,1,2,5,6,7,4],orientationDelta:[0,0,0,0,0,0,0,0]}}},derivedMoves:{UR_PLUS_:"[z': UL_PLUS_]",DR_PLUS_:"[z2: UL_PLUS_]",DL_PLUS_:"[z: UL_PLUS_]",R_PLUS_:"[z': U_PLUS_]",D_PLUS_:"[z2: U_PLUS_]",L_PLUS_:"[z: U_PLUS_]",F_PLUS_:"ALL_PLUS_",x2:"y2 z2",ULw_PLUS_:"U_PLUS_ L_PLUS_ UL_PLUS_'",URw_PLUS_:"U_PLUS_ R_PLUS_ UR_PLUS_'",DLw_PLUS_:"D_PLUS_ L_PLUS_ DL_PLUS_'",DRw_PLUS_:"D_PLUS_ R_PLUS_ DR_PLUS_'",BULw_PLUS_:"[y2: URw_PLUS_']",BURw_PLUS_:"[y2: ULw_PLUS_']",BDLw_PLUS_:"[y2: DRw_PLUS_']",BDRw_PLUS_:"[y2: DLw_PLUS_']",B_PLUS_:"[y2: ALL_PLUS_']",BU_PLUS_:"[y2: U_PLUS_']",BR_PLUS_:"[y2: L_PLUS_']",BD_PLUS_:"[y2: D_PLUS_']",BL_PLUS_:"[y2: R_PLUS_']",BUR_PLUS_:"[y2: UL_PLUS_']",BUL_PLUS_:"[y2: UR_PLUS_']",BDL_PLUS_:"[y2: DR_PLUS_']",BDR_PLUS_:"[y2: DL_PLUS_']",MUL_PLUS_:"UR_PLUS_' DL_PLUS_' U_PLUS_ R_PLUS_ D_PLUS_ L_PLUS_ ALL_PLUS_'",MUR_PLUS_:"UL_PLUS_' DR_PLUS_' U_PLUS_ L_PLUS_ D_PLUS_ R_PLUS_ ALL_PLUS_'",MDR_PLUS_:"MUL_PLUS_",MDL_PLUS_:"MUR_PLUS_",BMUL_PLUS_:"[y2: MUR_PLUS_']",BMUR_PLUS_:"[y2: MUL_PLUS_']",BMDR_PLUS_:"[y2: MDR_PLUS_']",BMDL_PLUS_:"[y2: MDL_PLUS_']",UL:".",UR:".",DL:".",DR:"."}},y=`<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 480 240" preserveAspectRatio="xMidYMid meet">
  <title>clock</title>
  <defs>
    <g id="hand" transform="translate(-20, -20)">
      <path d="M19.9995197,2.22079449 L23.8791657,19.0203611 C23.9580836,19.3338406 24,19.6620253 24,20 C24,22.209139 22.209139,24 20,24 C17.790861,24 16,22.209139 16,20 C16,19.6620253 16.0419164,19.3338406 16.1208343,19.0203611 L19.9995197,2.22079449 Z"></path>
    </g>
    <g id="cardinal_hour">
      <circle cx="0" cy="-24" r="3"></circle>
    </g>
    <g id="background_cardinal_hours" style="fill: #77889999">
      <circle cx="0" cy="24" r="1.5"></circle>
      <circle cx="-24" cy="0" r="1.5"></circle>
      <circle cx="24" cy="0" r="1.5"></circle>
      <circle cx="0" cy="-24" r="1.5"></circle>
    </g>
    <g id="background_face_hours">
      <g>
        <use href="#background_cardinal_hours"/>
      </g>
      <g transform="rotate(30)">
        <use href="#background_cardinal_hours"/>
      </g>
      <g  transform="rotate(60)">
        <use href="#background_cardinal_hours"/>
      </g>
    </g>
    <g id="peg">
      <circle id="PEG4" cx="0" cy="0" r="8"></circle>
    </g>
    <g id="frame" transform="translate(-24, -24)">
      <path stroke="#000000" d="M120,20 C137.495665,20 153.941932,24.4930026 168.247913,32.3881183 C171.855881,30.8514056 175.828512,30 180,30 C196.568542,30 210,43.4314575 210,60 C210,64.1714878 209.148594,68.1441192 207.610077,71.7536009 C215.506997,86.0580678 220,102.504335 220,120 C220,137.495665 215.506997,153.941932 207.611882,168.247913 C209.148594,171.855881 210,175.828512 210,180 C210,196.568542 196.568542,210 180,210 C175.828512,210 171.855881,209.148594 168.246399,207.610077 C153.941932,215.506997 137.495665,220 120,220 C102.504335,220 86.0580678,215.506997 71.7520869,207.611882 C68.1441192,209.148594 64.1714878,210 60,210 C43.4314575,210 30,196.568542 30,180 C30,175.828512 30.8514056,171.855881 32.3899234,168.246399 C24.4930026,153.941932 20,137.495665 20,120 C20,102.504335 24.4930026,86.0580678 32.3881183,71.7520869 C30.8514056,68.1441192 30,64.1714878 30,60 C30,43.4314575 43.4314575,30 60,30 C64.1714878,30 68.1441192,30.8514056 71.7536009,32.3899234 C86.0580678,24.4930026 102.504335,20 120,20 Z"></path>
    </g>
  </defs>
  <g>
    <g transform="translate(24, 24)">
      <use href="#frame" id="FRAME-l0-o0" style="fill: #113366"/>
      <use id="PEG_CAPS-l0-o0" href="#peg" transform="translate(66, 66)" style="fill: #446699"/>
      <use id="PEG_CAPS-l0-o1" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o2" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o3" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o4" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o5" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o6" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o7" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o8" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o9" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o10" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l0-o11" href="#peg" transform="translate(66, 66)" style="fill: #44669900"/>
      
      <use id="PEG_CAPS-l1-o0" href="#peg" transform="translate(126, 66)" style="fill: #446699"/>
      <use id="PEG_CAPS-l1-o1" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o2" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o3" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o4" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o5" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o6" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o7" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o8" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o9" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o10" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l1-o11" href="#peg" transform="translate(126, 66)" style="fill: #44669900"/>
      
      <use id="PEG_CAPS-l2-o0" href="#peg" transform="translate(126, 126)" style="fill: #446699"/>
      <use id="PEG_CAPS-l2-o1" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o2" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o3" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o4" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o5" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o6" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o7" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o8" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o9" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o10" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l2-o11" href="#peg" transform="translate(126, 126)" style="fill: #44669900"/>
      
      <use id="PEG_CAPS-l3-o0" href="#peg" transform="translate(66, 126)" style="fill: #446699"/>
      <use id="PEG_CAPS-l3-o1" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o2" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o3" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o4" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o5" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o6" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o7" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o8" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o9" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o10" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>
      <use id="PEG_CAPS-l3-o11" href="#peg" transform="translate(66, 126)" style="fill: #44669900"/>

      <g transform="translate(36, 36)">
        <circle id="FACES-l0-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l0-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l0-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l0-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l0-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l0-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l0-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l0-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l0-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l0-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l0-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l0-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l0-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l0-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l0-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l0-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l0-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(96, 36)">
        <circle id="FACES-l1-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l1-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l1-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l1-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l1-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l1-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l1-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l1-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l1-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l1-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l1-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l1-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l1-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l1-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l1-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l1-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l1-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(156, 36)">
        <circle id="FACES-l2-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l2-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l2-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l2-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l2-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l2-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l2-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l2-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l2-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l2-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l2-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l2-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l2-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l2-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l2-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l2-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l2-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(36, 96)">
        <circle id="FACES-l3-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l3-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l3-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l3-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l3-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l3-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l3-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l3-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l3-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l3-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l3-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l3-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l3-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l3-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l3-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l3-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l3-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(96, 96)">
        <circle id="FACES-l4-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l4-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l4-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l4-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l4-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l4-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l4-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l4-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l4-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l4-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l4-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l4-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l4-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l4-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l4-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l4-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l4-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(156, 96)">
        <circle id="FACES-l5-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l5-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l5-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l5-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l5-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l5-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l5-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l5-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l5-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l5-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l5-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l5-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l5-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l5-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l5-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l5-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l5-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(36, 156)">
        <circle id="FACES-l6-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l6-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l6-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l6-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l6-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l6-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l6-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l6-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l6-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l6-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l6-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l6-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l6-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l6-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l6-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l6-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l6-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(96, 156)">
        <circle id="FACES-l7-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l7-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l7-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l7-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l7-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l7-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l7-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l7-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l7-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l7-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l7-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l7-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l7-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l7-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l7-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l7-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l7-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(156, 156)">
        <circle id="FACES-l8-o0" stroke="#000000" style="fill: #CCDDEE" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l8-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="HOUR_MARKS-l8-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l8-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l8-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l8-o0"  href="#hand" transform="rotate(0)" style="fill: #CC0000"/>
          <use id="DIALS-l8-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l8-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l8-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l8-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l8-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l8-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l8-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l8-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l8-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l8-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l8-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
    </g>
    <g transform="translate(264, 24) scale(0.8)" transform-origin="96 96">
      <g transform="translate(32, 200)">
        <rect width="128" height="24" fill="#D9D9D9"/>
        <path d="M25.965 19.16C25.2317 19.16 24.4917 19.1333 23.745 19.08C22.9983 19.04 22.345 18.9467 21.785 18.8V5.34C22.0783 5.28667 22.3917 5.24 22.725 5.2C23.0583 5.14667 23.3983 5.10667 23.745 5.08C24.0917 5.05333 24.4317 5.03333 24.765 5.02C25.1117 5.00667 25.4383 5 25.745 5C26.585 5 27.365 5.06667 28.085 5.2C28.805 5.32 29.425 5.52667 29.945 5.82C30.4783 6.11333 30.8917 6.5 31.185 6.98C31.4783 7.46 31.625 8.05333 31.625 8.76C31.625 9.41333 31.465 9.97333 31.145 10.44C30.8383 10.9067 30.405 11.28 29.845 11.56C30.685 11.84 31.305 12.2533 31.705 12.8C32.105 13.3467 32.305 14.04 32.305 14.88C32.305 16.3067 31.785 17.38 30.745 18.1C29.705 18.8067 28.1117 19.16 25.965 19.16ZM24.265 12.76V16.98C24.545 17.0067 24.845 17.0267 25.165 17.04C25.485 17.0533 25.7783 17.06 26.045 17.06C26.565 17.06 27.045 17.0267 27.485 16.96C27.9383 16.8933 28.325 16.78 28.645 16.62C28.9783 16.4467 29.2383 16.22 29.425 15.94C29.625 15.66 29.725 15.3 29.725 14.86C29.725 14.0733 29.4383 13.5267 28.865 13.22C28.2917 12.9133 27.4983 12.76 26.485 12.76H24.265ZM24.265 10.78H26.045C27.005 10.78 27.7583 10.6467 28.305 10.38C28.8517 10.1 29.125 9.60667 29.125 8.9C29.125 8.23333 28.8383 7.76 28.265 7.48C27.705 7.2 26.9717 7.06 26.065 7.06C25.6783 7.06 25.3317 7.06667 25.025 7.08C24.7317 7.09333 24.4783 7.11333 24.265 7.14V10.78ZM41.9735 19C41.8562 18.616 41.7229 18.2213 41.5735 17.816C41.4349 17.4107 41.2962 17.0053 41.1575 16.6H36.8375C36.6989 17.0053 36.5549 17.4107 36.4055 17.816C36.2669 18.2213 36.1389 18.616 36.0215 19H33.4295C33.8455 17.8053 34.2402 16.7013 34.6135 15.688C34.9869 14.6747 35.3495 13.72 35.7015 12.824C36.0642 11.928 36.4162 11.08 36.7575 10.28C37.1095 9.46933 37.4722 8.68 37.8455 7.912H40.2295C40.5922 8.68 40.9495 9.46933 41.3015 10.28C41.6535 11.08 42.0055 11.928 42.3575 12.824C42.7202 13.72 43.0882 14.6747 43.4615 15.688C43.8349 16.7013 44.2295 17.8053 44.6455 19H41.9735ZM38.9815 10.424C38.9282 10.584 38.8482 10.8027 38.7415 11.08C38.6349 11.3573 38.5122 11.6773 38.3735 12.04C38.2349 12.4027 38.0802 12.8027 37.9095 13.24C37.7495 13.6773 37.5842 14.136 37.4135 14.616H40.5655C40.3949 14.136 40.2295 13.6773 40.0695 13.24C39.9095 12.8027 39.7549 12.4027 39.6055 12.04C39.4669 11.6773 39.3442 11.3573 39.2375 11.08C39.1309 10.8027 39.0455 10.584 38.9815 10.424ZM50.7305 19.224C48.9279 19.224 47.5519 18.7227 46.6025 17.72C45.6639 16.7173 45.1945 15.2933 45.1945 13.448C45.1945 12.5307 45.3385 11.7147 45.6265 11C45.9145 10.2747 46.3092 9.66667 46.8105 9.176C47.3119 8.67467 47.9092 8.296 48.6025 8.04C49.2959 7.784 50.0479 7.656 50.8585 7.656C51.3279 7.656 51.7545 7.69333 52.1385 7.768C52.5225 7.832 52.8585 7.912 53.1465 8.008C53.4345 8.09333 53.6745 8.184 53.8665 8.28C54.0585 8.376 54.1972 8.45067 54.2825 8.504L53.5625 10.52C53.2212 10.3387 52.8212 10.184 52.3625 10.056C51.9145 9.928 51.4025 9.864 50.8265 9.864C50.4425 9.864 50.0639 9.928 49.6905 10.056C49.3279 10.184 49.0025 10.392 48.7145 10.68C48.4372 10.9573 48.2132 11.32 48.0425 11.768C47.8719 12.216 47.7865 12.76 47.7865 13.4C47.7865 13.912 47.8399 14.392 47.9465 14.84C48.0639 15.2773 48.2452 15.656 48.4905 15.976C48.7465 16.296 49.0772 16.552 49.4825 16.744C49.8879 16.9253 50.3785 17.016 50.9545 17.016C51.3172 17.016 51.6425 16.9947 51.9305 16.952C52.2185 16.9093 52.4745 16.8613 52.6985 16.808C52.9225 16.744 53.1199 16.6747 53.2905 16.6C53.4612 16.5253 53.6159 16.456 53.7545 16.392L54.4425 18.392C54.0905 18.6053 53.5945 18.7973 52.9545 18.968C52.3145 19.1387 51.5732 19.224 50.7305 19.224ZM62.5935 19C62.3695 18.6373 62.1029 18.248 61.7935 17.832C61.4949 17.4053 61.1642 16.984 60.8015 16.568C60.4495 16.1413 60.0815 15.736 59.6975 15.352C59.3135 14.9573 58.9295 14.6107 58.5455 14.312V19H56.0495V7.912H58.5455V12.104C59.1962 11.4213 59.8469 10.712 60.4975 9.976C61.1589 9.22933 61.7722 8.54133 62.3375 7.912H65.2975C64.5402 8.808 63.7775 9.672 63.0095 10.504C62.2522 11.336 61.4522 12.1733 60.6095 13.016C61.4949 13.752 62.3482 14.6267 63.1695 15.64C64.0015 16.6533 64.7962 17.7733 65.5535 19H62.5935ZM75.5317 17.12C76.4384 17.12 77.0984 16.9667 77.5117 16.66C77.9251 16.3533 78.1317 15.92 78.1317 15.36C78.1317 15.0267 78.0584 14.74 77.9117 14.5C77.7784 14.26 77.5784 14.0467 77.3117 13.86C77.0584 13.66 76.7451 13.48 76.3717 13.32C75.9984 13.1467 75.5717 12.98 75.0917 12.82C74.6117 12.6467 74.1451 12.46 73.6917 12.26C73.2517 12.0467 72.8584 11.7867 72.5117 11.48C72.1784 11.1733 71.9051 10.8067 71.6917 10.38C71.4917 9.95333 71.3917 9.44 71.3917 8.84C71.3917 7.58667 71.8251 6.60667 72.6917 5.9C73.5584 5.18 74.7384 4.82 76.2317 4.82C77.0984 4.82 77.8651 4.92 78.5317 5.12C79.2117 5.30667 79.7451 5.51333 80.1317 5.74L79.3517 7.78C78.8984 7.52667 78.3984 7.33333 77.8517 7.2C77.3184 7.06667 76.7651 7 76.1917 7C75.5117 7 74.9784 7.14 74.5917 7.42C74.2184 7.7 74.0317 8.09333 74.0317 8.6C74.0317 8.90667 74.0917 9.17333 74.2117 9.4C74.3451 9.61333 74.5251 9.80667 74.7517 9.98C74.9917 10.1533 75.2651 10.3133 75.5717 10.46C75.8917 10.6067 76.2384 10.7467 76.6117 10.88C77.2651 11.12 77.8451 11.3667 78.3517 11.62C78.8717 11.86 79.3051 12.1533 79.6517 12.5C80.0117 12.8333 80.2851 13.2333 80.4717 13.7C80.6584 14.1533 80.7517 14.7067 80.7517 15.36C80.7517 16.6133 80.3051 17.5867 79.4117 18.28C78.5317 18.96 77.2384 19.3 75.5317 19.3C74.9584 19.3 74.4317 19.26 73.9517 19.18C73.4851 19.1133 73.0651 19.0267 72.6917 18.92C72.3317 18.8133 72.0184 18.7067 71.7517 18.6C71.4851 18.48 71.2717 18.3733 71.1117 18.28L71.8517 16.22C72.2117 16.42 72.6984 16.62 73.3117 16.82C73.9251 17.02 74.6651 17.12 75.5317 17.12ZM82.5925 7.912H85.0885V19H82.5925V7.912ZM90.151 16.968C90.2683 16.9787 90.4017 16.9893 90.551 17C90.711 17 90.8977 17 91.111 17C92.359 17 93.2817 16.6853 93.879 16.056C94.487 15.4267 94.791 14.5573 94.791 13.448C94.791 12.2853 94.503 11.4053 93.927 10.808C93.351 10.2107 92.439 9.912 91.191 9.912C91.0203 9.912 90.8443 9.91733 90.663 9.928C90.4817 9.928 90.311 9.93867 90.151 9.96V16.968ZM97.367 13.448C97.367 14.408 97.2177 15.2453 96.919 15.96C96.6203 16.6747 96.1937 17.2667 95.639 17.736C95.095 18.2053 94.4283 18.5573 93.639 18.792C92.8497 19.0267 91.9643 19.144 90.983 19.144C90.535 19.144 90.0123 19.1227 89.415 19.08C88.8177 19.048 88.231 18.9733 87.655 18.856V8.056C88.231 7.94933 88.8283 7.88 89.447 7.848C90.0763 7.80533 90.615 7.784 91.063 7.784C92.0123 7.784 92.871 7.89067 93.639 8.104C94.4177 8.31733 95.0843 8.65333 95.639 9.112C96.1937 9.57067 96.6203 10.1573 96.919 10.872C97.2177 11.5867 97.367 12.4453 97.367 13.448ZM99.4519 19V7.912H106.94V10.008H101.948V12.184H106.38V14.232H101.948V16.904H107.308V19H99.4519Z" fill="black"/>
      </g>
      <use href="#frame" id="FRAME-l0-o1" style="fill: #CCDDEE"/>

      <use id="PEG_CAPS-l4-o0" href="#peg" transform="translate(66, 66)" style="fill: #88AACC"/>
      <use id="PEG_CAPS-l4-o1" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o2" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o3" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o4" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o5" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o6" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o7" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o8" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o9" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o10" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l4-o11" href="#peg" transform="translate(66, 66)" style="fill: #88AACC00"/>
      
      <use id="PEG_CAPS-l5-o0" href="#peg" transform="translate(126, 66)" style="fill: #88AACC"/>
      <use id="PEG_CAPS-l5-o1" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o2" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o3" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o4" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o5" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o6" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o7" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o8" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o9" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o10" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l5-o11" href="#peg" transform="translate(126, 66)" style="fill: #88AACC00"/>
      
      <use id="PEG_CAPS-l6-o0" href="#peg" transform="translate(126, 126)" style="fill: #88AACC"/>
      <use id="PEG_CAPS-l6-o1" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o2" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o3" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o4" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o5" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o6" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o7" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o8" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o9" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o10" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l6-o11" href="#peg" transform="translate(126, 126)" style="fill: #88AACC00"/>
      
      <use id="PEG_CAPS-l7-o0" href="#peg" transform="translate(66, 126)" style="fill: #88AACC"/>
      <use id="PEG_CAPS-l7-o1" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o2" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o3" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o4" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o5" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o6" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o7" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o8" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o9" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o10" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>
      <use id="PEG_CAPS-l7-o11" href="#peg" transform="translate(66, 126)" style="fill: #88AACC00"/>

      <g transform="translate(36, 36)">
        <circle id="FACES-l9-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l9-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l9-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l9-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l9-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l9-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l9-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l9-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l9-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l9-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l9-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l9-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l9-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l9-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l9-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l9-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l9-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(96, 36)">
        <circle id="FACES-l10-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l10-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l10-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l10-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l10-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l10-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l10-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l10-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l10-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l10-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l10-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l10-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l10-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l10-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l10-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l10-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l10-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(156, 36)">
        <circle id="FACES-l11-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l11-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l11-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l11-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l11-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l11-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l11-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l11-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l11-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l11-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l11-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l11-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l11-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l11-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l11-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l11-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l11-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(36, 96)">
        <circle id="FACES-l12-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l12-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l12-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l12-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l12-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l12-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l12-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l12-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l12-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l12-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l12-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l12-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l12-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l12-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l12-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l12-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l12-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(96, 96)">
        <circle id="FACES-l13-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l13-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l13-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l13-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l13-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l13-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l13-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l13-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l13-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l13-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l13-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l13-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l13-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l13-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l13-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l13-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l13-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(156, 96)">
        <circle id="FACES-l14-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l14-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l14-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l14-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l14-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l14-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l14-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l14-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l14-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l14-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l14-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l14-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l14-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l14-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l14-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l14-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l14-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(36, 156)">
        <circle id="FACES-l15-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l15-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l15-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l15-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l15-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l15-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l15-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l15-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l15-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l15-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l15-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l15-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l15-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l15-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l15-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l15-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l15-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(96, 156)">
        <circle id="FACES-l16-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l16-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l16-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l16-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l16-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l16-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l16-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l16-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l16-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l16-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l16-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l16-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l16-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l16-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l16-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l16-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l16-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
      <g transform="translate(156, 156)">
        <circle id="FACES-l17-o0" stroke="#000000" style="fill: #113366" r="20"></circle>
        <use href="#background_face_hours"/>
        <g>
          <use id="HOUR_MARKS-l17-o0" href="#cardinal_hour" transform="rotate(0)" style="fill: #CC6600"/>
          <use id="HOUR_MARKS-l17-o1" href="#cardinal_hour" transform="rotate(90)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l17-o2" href="#cardinal_hour" transform="rotate(180)" style="fill: #0000"/>
          <use id="HOUR_MARKS-l17-o3" href="#cardinal_hour" transform="rotate(270)" style="fill: #0000"/>
        </g>
        <g>
          <use id="DIALS-l17-o0"  href="#hand" transform="rotate(0)" style="fill: #FFCC44"/>
          <use id="DIALS-l17-o1"  href="#hand" transform="rotate(30)" style="fill: #0000"/>
          <use id="DIALS-l17-o2"  href="#hand" transform="rotate(60)" style="fill: #0000"/>
          <use id="DIALS-l17-o3"  href="#hand" transform="rotate(90)" style="fill: #0000"/>
          <use id="DIALS-l17-o4"  href="#hand" transform="rotate(120)" style="fill: #0000"/>
          <use id="DIALS-l17-o5"  href="#hand" transform="rotate(150)" style="fill: #0000"/>
          <use id="DIALS-l17-o6"  href="#hand" transform="rotate(180)" style="fill: #0000"/>
          <use id="DIALS-l17-o7"  href="#hand" transform="rotate(210)" style="fill: #0000"/>
          <use id="DIALS-l17-o8"  href="#hand" transform="rotate(240)" style="fill: #0000"/>
          <use id="DIALS-l17-o9"  href="#hand" transform="rotate(270)" style="fill: #0000"/>
          <use id="DIALS-l17-o10" href="#hand" transform="rotate(300)" style="fill: #0000"/>
          <use id="DIALS-l17-o11" href="#hand" transform="rotate(330)" style="fill: #0000"/>
        </g>
      </g>
    </g>
  </g>
</svg>`,h=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN"
       "http://www.w3.org/TR/2001/REC-SVG-20050904/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-20 -20 546 480" preserveAspectRatio="xMidYMid meet">
  <defs>
  </defs>
  <title>pyraminx</title>
  <defs>
    <g id="stickerA" transform="scale(1, 0.577350269)">
      <path
         d="m 0,1.732050808 1,-1.732050808 1,1.732050808 z"
         stroke="black" stroke-width="0.04px" stroke-linecap="butt" stroke-linejoin="round"
      />
    </g>
    <g id="stickerV" transform="scale(1, 0.577350269)">
      <path
         d="m 0,0 1,1.732050808 1,-1.732050808 z"
         stroke="black" stroke-width="0.04px" stroke-linecap="butt" stroke-linejoin="round"
      />
    </g>
  </defs>

<!--        0 1 2 3 4 5 6 7 8 9 10   -->
<!--        | | | | | | | | | | |    -->
<!--    0 - L L L L L F R R R R R    -->
<!--    1 -   L L L F F F R R R      -->
<!--    2 -     L F F F F F R        -->
<!--    3 -       D D D D D          -->
<!--    4 -         D D D            -->
<!--    5 -           D              -->

  <g id="puzzle" transform="translate(5, 5) scale(40, 69.28203232)">
    <!-- CORNERS -->
    <use id="CORNERS-l0-o0" href="#stickerV" transform="translate(5.2, 1.066666667)" style="fill: limegreen"/>
    <use id="CORNERS-l0-o1" href="#stickerA" transform="translate(3, 0)" style="fill: red"/>
    <use id="CORNERS-l0-o2" href="#stickerA" transform="translate(7.4, 0)" style="fill: #26f"/>

    <use id="CORNERS-l3-o0" href="#stickerA" transform="translate(4.2, 3.2)" style="fill: yellow"/>
    <use id="CORNERS-l3-o1" href="#stickerA" transform="translate(2, 1)" style="fill: red"/>
    <use id="CORNERS-l3-o2" href="#stickerV" transform="translate(4.2, 2.066666667)" style="fill: limegreen"/>

    <use id="CORNERS-l2-o0" href="#stickerA" transform="translate(6.2, 3.2)" style="fill: yellow"/>
    <use id="CORNERS-l2-o1" href="#stickerV" transform="translate(6.2, 2.066666667)" style="fill: limegreen"/>
    <use id="CORNERS-l2-o2" href="#stickerA" transform="translate(8.4, 1)" style="fill: #26f"/>

    <use id="CORNERS-l1-o1" href="#stickerA" transform="translate(9.4, 0)" style="fill: #26f"/>
    <use id="CORNERS-l1-o2" href="#stickerA" transform="translate(1, 0)" style="fill: red"/>
    <use id="CORNERS-l1-o0" href="#stickerA" transform="translate(5.2, 4.2)" style="fill: yellow"/>

    <!-- "TIPS" -->
    <!-- CORNERS2 -->
    <use id="CORNERS2-l0-o0" href="#stickerA" transform="translate(5.2, 0.066666667)" style="fill: limegreen"/>
    <use id="CORNERS2-l0-o1" href="#stickerV" transform="translate(4, 0)" style="fill: red"/>
    <use id="CORNERS2-l0-o2" href="#stickerV" transform="translate(6.4, 0)" style="fill: #26f"/>

    <use id="CORNERS2-l3-o0" href="#stickerV" transform="translate(3.2, 3.2)" style="fill: yellow"/>
    <use id="CORNERS2-l3-o1" href="#stickerV" transform="translate(2, 2)" style="fill: red"/>
    <use id="CORNERS2-l3-o2" href="#stickerA" transform="translate(3.2, 2.066666667)" style="fill: limegreen"/>

    <use id="CORNERS2-l2-o0" href="#stickerV" transform="translate(7.2, 3.2)" style="fill: yellow"/>
    <use id="CORNERS2-l2-o1" href="#stickerA" transform="translate(7.2, 2.066666667)" style="fill: limegreen"/>
    <use id="CORNERS2-l2-o2" href="#stickerV" transform="translate(8.4, 2)" style="fill: #26f"/>

    <use id="CORNERS2-l1-o1" href="#stickerV" transform="translate(10.4,0)" style="fill: #26f"/>
    <use id="CORNERS2-l1-o2" href="#stickerV" transform="translate(0, 0)" style="fill: red"/>
    <use id="CORNERS2-l1-o0" href="#stickerV" transform="translate(5.2, 5.2)" style="fill: yellow"/>

    <!-- EDGES -->
    <use id="EDGES-l0-o0" href="#stickerV" transform="translate(3, 1)" style="fill: red"/>
    <use id="EDGES-l0-o1" href="#stickerA" transform="translate(4.2, 1.066666667)" style="fill: limegreen"/>

    <use id="EDGES-l5-o0" href="#stickerA" transform="translate(6.2, 1.066666667)" style="fill: limegreen"/>
    <use id="EDGES-l5-o1" href="#stickerV" transform="translate(7.4, 1)" style="fill: #26f"/>

    <use id="EDGES-l1-o0" href="#stickerV" transform="translate(8.4, 0)" style="fill: #26f"/>
    <use id="EDGES-l1-o1" href="#stickerV" transform="translate(2, 0)" style="fill: red"/>

    <use id="EDGES-l2-o0" href="#stickerV" transform="translate(5.2, 3.2)" style="fill: yellow"/>
    <use id="EDGES-l2-o1" href="#stickerA" transform="translate(5.2, 2.066666667)" style="fill: limegreen"/>

    <use id="EDGES-l3-o0" href="#stickerV" transform="translate(9.4, 1)" style="fill: #26f"/>
    <use id="EDGES-l3-o1" href="#stickerV" transform="translate(6.2, 4.2)" style="fill: yellow"/>

    <use id="EDGES-l4-o0" href="#stickerV" transform="translate(4.2, 4.2)" style="fill: yellow"/>
    <use id="EDGES-l4-o1" href="#stickerV" transform="translate(1, 1)" style="fill: red"/>
  </g>

</svg>`,p={name:"Square-1",orbits:[{orbitName:"WEDGES",numPieces:24,numOrientations:9},{orbitName:"EQUATOR",numPieces:2,numOrientations:6}],defaultPattern:{WEDGES:{pieces:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],orientation:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},EQUATOR:{pieces:[0,1],orientation:[0,0]}},moves:{U_SQ_:{WEDGES:{permutation:[11,0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23],orientationDelta:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},EQUATOR:{permutation:[0,1],orientationDelta:[0,0]}},D_SQ_:{WEDGES:{permutation:[0,1,2,3,4,5,6,7,8,9,10,11,23,12,13,14,15,16,17,18,19,20,21,22],orientationDelta:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},EQUATOR:{permutation:[0,1],orientationDelta:[0,0]}},_SLASH_:{WEDGES:{permutation:[0,1,2,3,4,5,12,13,14,15,16,17,6,7,8,9,10,11,18,19,20,21,22,23],orientationDelta:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},EQUATOR:{permutation:[0,1],orientationDelta:[0,3]}}}},S=`<?xml version="1.0" encoding="UTF-8"?>
<svg width="360px" height="552px" viewBox="0 0 360 552" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <!-- Generator: Sketch 59.1 (86144) - https://sketch.com -->
    <title>sq1-fancy</title>
    <desc>Created with Sketch.</desc>
    <!-- stroke="none" -->
    <g id="sq1-fancy" stroke="#888" stroke-width="0.25" fill="none" fill-rule="evenodd">
        <g id="EQUATOR" transform="translate(24.000000, 264.000000)">
            <rect id="EQUATOR-l1-o3" style="fill: red" x="168" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l1-o4" style="fill: red" x="192" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l1-o5" style="fill: limegreen" x="216" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l1-o2" style="fill: limegreen" x="240" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l1-o1" style="fill: limegreen" x="264" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l1-o0" style="fill: orange" x="288" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l0-o3" style="fill: orange" x="0" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l0-o4" style="fill: orange" x="24" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l0-o5" style="fill: #26f" x="48" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l0-o2" style="fill: #26f" x="72" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l0-o1" style="fill: #26f" x="96" y="0" width="24" height="24"></rect>
            <rect id="EQUATOR-l0-o0" style="fill: red" x="120" y="0" width="24" height="24"></rect>
        </g>
        <g id="BOTTOM" transform="translate(41.000000, 257.000000)" stroke-linejoin="round">
            <g id="WEDGES-23" transform="translate(130.000000, 88.588457) rotate(120.000000) translate(-130.000000, -88.588457) translate(82.000000, 22.588457)">
                <polygon id="WEDGES-l23-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l23-o7" style="fill: red" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l23-o6" style="fill: red" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l23-o5" style="fill: red" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l23-o4" style="fill: red" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l23-o3" style="fill: white" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l23-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l23-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l23-o0" style="fill: red" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-22" transform="translate(97.157677, 115.157677) rotate(90.000000) translate(-97.157677, -115.157677) translate(49.157677, 49.157677)">
                <polygon id="WEDGES-l22-o8" style="fill: #26f" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l22-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l22-o6" style="fill: #26f" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l22-o5" style="fill: #26f" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l22-o4" style="fill: white" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l22-o3" style="fill: #26f" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l22-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l22-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l22-o0" style="fill: #26f" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-21" transform="translate(82.000000, 154.588457) rotate(60.000000) translate(-82.000000, -154.588457) translate(34.000000, 88.588457)">
                <polygon id="WEDGES-l21-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l21-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l21-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l21-o5" style="fill: #26f" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l21-o4" style="fill: #26f" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l21-o3" style="fill: #26f" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l21-o2" style="fill: #26f" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l21-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l21-o0" style="fill: #26f" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-20" transform="translate(88.588457, 196.315353) rotate(30.000000) translate(-88.588457, -196.315353) translate(40.588457, 130.315353)">
                <polygon id="WEDGES-l20-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l20-o7" style="fill: #26f" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l20-o6" style="fill: #26f" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l20-o5" style="fill: #26f" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l20-o4" style="fill: #26f" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l20-o3" style="fill: white" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l20-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l20-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l20-o0" style="fill: #26f" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-19" transform="translate(67.157677, 163.157677)">
                <polygon id="WEDGES-l19-o8" style="fill: orange" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l19-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l19-o6" style="fill: orange" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l19-o5" style="fill: orange" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l19-o4" style="fill: white" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l19-o3" style="fill: orange" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l19-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l19-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l19-o0" style="fill: orange" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-18" transform="translate(154.588457, 244.315353) scale(-1, -1) rotate(150.000000) translate(-154.588457, -244.315353) translate(106.588457, 178.315353)">
                <polygon id="WEDGES-l18-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l18-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l18-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l18-o5" style="fill: orange" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l18-o4" style="fill: orange" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l18-o3" style="fill: orange" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l18-o2" style="fill: orange" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l18-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l18-o0" style="fill: orange" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-17" transform="translate(196.315353, 237.726896) scale(-1, -1) rotate(120.000000) translate(-196.315353, -237.726896) translate(148.315353, 171.726896)">
                <polygon id="WEDGES-l17-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l17-o7" style="fill: orange" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l17-o6" style="fill: orange" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l17-o5" style="fill: orange" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l17-o4" style="fill: orange" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l17-o3" style="fill: white" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l17-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l17-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l17-o0" style="fill: orange" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-16" transform="translate(229.157677, 211.157677) scale(-1, -1) rotate(90.000000) translate(-229.157677, -211.157677) translate(181.157677, 145.157677)">
                <polygon id="WEDGES-l16-o8" style="fill: limegreen" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l16-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l16-o6" style="fill: limegreen" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l16-o5" style="fill: limegreen" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l16-o4" style="fill: white" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l16-o3" style="fill: limegreen" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l16-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l16-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l16-o0" style="fill: limegreen" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-15" transform="translate(244.315353, 171.726896) scale(-1, -1) rotate(60.000000) translate(-244.315353, -171.726896) translate(196.315353, 105.726896)">
                <polygon id="WEDGES-l15-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l15-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l15-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l15-o5" style="fill: limegreen" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l15-o4" style="fill: limegreen" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l15-o3" style="fill: limegreen" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l15-o2" style="fill: limegreen" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l15-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l15-o0" style="fill: limegreen" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-14" transform="translate(237.726896, 130.000000) scale(-1, -1) rotate(30.000000) translate(-237.726896, -130.000000) translate(189.726896, 64.000000)">
                <polygon id="WEDGES-l14-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l14-o7" style="fill: limegreen" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l14-o6" style="fill: limegreen" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l14-o5" style="fill: limegreen" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l14-o4" style="fill: limegreen" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l14-o3" style="fill: white" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l14-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l14-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l14-o0" style="fill: limegreen" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-13" transform="translate(211.157677, 97.157677) scale(-1, -1) translate(-211.157677, -97.157677) translate(163.157677, 31.157677)">
                <polygon id="WEDGES-l13-o8" style="fill: red" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l13-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l13-o6" style="fill: red" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l13-o5" style="fill: red" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l13-o4" style="fill: white" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l13-o3" style="fill: red" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l13-o2" style="fill: white" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l13-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l13-o0" style="fill: red" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-12" transform="translate(171.726896, 82.000000) rotate(150.000000) translate(-171.726896, -82.000000) translate(123.726896, 16.000000)">
                <polygon id="WEDGES-l12-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l12-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l12-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l12-o5" style="fill: red" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l12-o4" style="fill: red" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l12-o3" style="fill: red" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l12-o2" style="fill: red" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l12-o1" style="fill: white" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l12-o0" style="fill: red" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
        </g>
        <g id="TOP" transform="translate(41.000000, -31.000000)" stroke-linejoin="round">
            <g id="WEDGES-11" transform="translate(154.588457, 244.315353) scale(-1, -1) rotate(150.000000) translate(-154.588457, -244.315353) translate(106.588457, 178.315353)">
                <polygon id="WEDGES-l11-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l11-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l11-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l11-o5" style="fill: red" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l11-o4" style="fill: red" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l11-o3" style="fill: red" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l11-o2" style="fill: red" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l11-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l11-o0" style="fill: red" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-10" transform="translate(196.315353, 237.726896) scale(-1, -1) rotate(120.000000) translate(-196.315353, -237.726896) translate(148.315353, 171.726896)">
                <polygon id="WEDGES-l10-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l10-o7" style="fill: red" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l10-o6" style="fill: red" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l10-o5" style="fill: red" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l10-o4" style="fill: red" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l10-o3" style="fill: yellow" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l10-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l10-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l10-o0" style="fill: red" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-9" transform="translate(229.157677, 211.157677) scale(-1, -1) rotate(90.000000) translate(-229.157677, -211.157677) translate(181.157677, 145.157677)">
                <polygon id="WEDGES-l9-o8" style="fill: limegreen" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l9-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l9-o6" style="fill: limegreen" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l9-o5" style="fill: limegreen" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l9-o4" style="fill: yellow" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l9-o3" style="fill: limegreen" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l9-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l9-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l9-o0" style="fill: limegreen" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-8" transform="translate(244.315353, 171.726896) scale(-1, -1) rotate(60.000000) translate(-244.315353, -171.726896) translate(196.315353, 105.726896)">
                <polygon id="WEDGES-l8-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l8-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l8-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l8-o5" style="fill: limegreen" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l8-o4" style="fill: limegreen" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l8-o3" style="fill: limegreen" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l8-o2" style="fill: limegreen" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l8-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l8-o0" style="fill: limegreen" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-7" transform="translate(237.726896, 130.000000) scale(-1, -1) rotate(30.000000) translate(-237.726896, -130.000000) translate(189.726896, 64.000000)">
                <polygon id="WEDGES-l7-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l7-o7" style="fill: limegreen" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l7-o6" style="fill: limegreen" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l7-o5" style="fill: limegreen" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l7-o4" style="fill: limegreen" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l7-o3" style="fill: yellow" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l7-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l7-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l7-o0" style="fill: limegreen" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-6" transform="translate(211.157677, 97.157677) scale(-1, -1) translate(-211.157677, -97.157677) translate(163.157677, 31.157677)">
                <polygon id="WEDGES-l6-o8" style="fill: orange" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l6-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l6-o6" style="fill: orange" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l6-o5" style="fill: orange" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l6-o4" style="fill: yellow" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l6-o3" style="fill: orange" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l6-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l6-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l6-o0" style="fill: orange" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-5" transform="translate(171.726896, 82.000000) rotate(150.000000) translate(-171.726896, -82.000000) translate(123.726896, 16.000000)">
                <polygon id="WEDGES-l5-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l5-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l5-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l5-o5" style="fill: orange" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l5-o4" style="fill: orange" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l5-o3" style="fill: orange" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l5-o2" style="fill: orange" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l5-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l5-o0" style="fill: orange" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-4" transform="translate(130.000000, 88.588457) rotate(120.000000) translate(-130.000000, -88.588457) translate(82.000000, 22.588457)">
                <polygon id="WEDGES-l4-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l4-o7" style="fill: orange" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l4-o6" style="fill: orange" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l4-o5" style="fill: orange" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l4-o4" style="fill: orange" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l4-o3" style="fill: yellow" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l4-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l4-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l4-o0" style="fill: orange" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-3" transform="translate(97.157677, 115.157677) rotate(90.000000) translate(-97.157677, -115.157677) translate(49.157677, 49.157677)">
                <polygon id="WEDGES-l3-o8" style="fill: #26f" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l3-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l3-o6" style="fill: #26f" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l3-o5" style="fill: #26f" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l3-o4" style="fill: yellow" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l3-o3" style="fill: #26f" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l3-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l3-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l3-o0" style="fill: #26f" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-2" transform="translate(82.000000, 154.588457) rotate(60.000000) translate(-82.000000, -154.588457) translate(34.000000, 88.588457)">
                <polygon id="WEDGES-l2-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l2-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l2-o6" style="fill: #D8D8D8" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l2-o5" style="fill: #26f" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l2-o4" style="fill: #26f" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l2-o3" style="fill: #26f" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l2-o2" style="fill: #26f" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l2-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l2-o0" style="fill: #26f" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-1" transform="translate(88.588457, 196.315353) rotate(30.000000) translate(-88.588457, -196.315353) translate(40.588457, 130.315353)">
                <polygon id="WEDGES-l1-o8" style="fill: #D8D8D8" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l1-o7" style="fill: #26f" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l1-o6" style="fill: #26f" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l1-o5" style="fill: #26f" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l1-o4" style="fill: #26f" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l1-o3" style="fill: yellow" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l1-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l1-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l1-o0" style="fill: #26f" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
            <g id="WEDGES-0" transform="translate(67.157677, 163.157677)">
                <polygon id="WEDGES-l0-o8" style="fill: red" points="25.723 70.277 40.574 95.999 -2.27373675e-13 96"></polygon>
                <polygon id="WEDGES-l0-o7" style="fill: #D8D8D8" points="70.2768775 96 60.8615612 131.138439 40.5741225 95.9988775"></polygon>
                <polygon id="WEDGES-l0-o6" style="fill: red" points="70.2768775 96 40.574 95.999 25.7231225 70.2768775"></polygon>
                <polygon id="WEDGES-l0-o5" style="fill: red" points="48.0001225 47.9995 68.287 47.9995 78.4307806 65.5692194"></polygon>
                <polygon id="WEDGES-l0-o4" style="fill: yellow" points="60.8615 35.1385 68.287 47.9995 48 48"></polygon>
                <polygon id="WEDGES-l0-o3" style="fill: red" points="83.1384388 48 78.4307806 65.5692194 68.2870612 47.9994388"></polygon>
                <polygon id="WEDGES-l0-o2" style="fill: yellow" points="83.1384388 48 68.287 47.9995 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l0-o1" style="fill: yellow" points="96 0 83.1384388 48 60.8615612 35.1384388"></polygon>
                <polygon id="WEDGES-l0-o0" style="fill: red" points="70.2768775 96 25.7231225 70.2768775 48.0001225 47.9995 78.4307806 65.5692194"></polygon>
            </g>
        </g>
        <g id="DIAGONALS" transform="translate(168.861561, 1.019238)" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <line x1="0" y1="287.842323" x2="70.2768775" y2="550.119201" id="BOTTOM"></line>
            <line x1="0.15767665" y1="262.276878" x2="70.4345542" y2="2.27488928e-16" id="TOP"></line>
        </g>
    </g>
</svg>`,l=new Array(64).fill(0),s=l.map((i,r)=>r),E={name:"Melinda's 2x2x2x2",orbits:[{orbitName:"CORNERS",numPieces:64,numOrientations:1}],defaultPattern:{CORNERS:{pieces:s,orientation:l}},moves:{Rx:{CORNERS:{permutation:[16,19,17,18,20,22,23,21,4,7,5,6,0,2,3,1,28,30,31,29,24,27,25,26,8,10,11,9,12,15,13,14,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63],orientationDelta:l}},Ry:{CORNERS:{permutation:[12,13,14,15,0,1,2,3,4,5,6,7,8,9,10,11,28,29,30,31,16,17,18,19,20,21,22,23,24,25,26,27,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63],orientationDelta:l}},Rz:{CORNERS:{permutation:[4,6,7,5,20,23,21,22,24,26,27,25,8,11,9,10,0,3,1,2,16,18,19,17,28,31,29,30,12,14,15,13,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63],orientationDelta:l}},Lx:{CORNERS:{permutation:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,48,51,49,50,52,54,55,53,36,39,37,38,32,34,35,33,60,62,63,61,56,59,57,58,40,42,43,41,44,47,45,46],orientationDelta:l}},Ly:{CORNERS:{permutation:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,44,45,46,47,32,33,34,35,36,37,38,39,40,41,42,43,60,61,62,63,48,49,50,51,52,53,54,55,56,57,58,59],orientationDelta:l}},Lz:{CORNERS:{permutation:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,36,38,39,37,52,55,53,54,56,58,59,57,40,43,41,42,32,35,33,34,48,50,51,49,60,63,61,62,44,46,47,45],orientationDelta:l}},Mx:{CORNERS:{permutation:[0,1,2,3,20,22,23,21,4,7,5,6,12,13,14,15,16,17,18,19,24,27,25,26,8,10,11,9,28,29,30,31,48,51,49,50,36,37,38,39,40,41,42,43,32,34,35,33,60,62,63,61,52,53,54,55,56,57,58,59,44,47,45,46],orientationDelta:l}},My:{CORNERS:{permutation:[0,1,2,3,9,8,11,10,45,44,47,46,12,13,14,15,16,17,18,19,25,24,27,26,61,60,63,62,28,29,30,31,5,4,7,6,36,37,38,39,40,41,42,43,33,32,35,34,21,20,23,22,52,53,54,55,56,57,58,59,49,48,51,50],orientationDelta:l}},Mz:{CORNERS:{permutation:[0,1,2,3,34,33,35,32,47,45,44,46,12,13,14,15,16,17,18,19,7,5,4,6,10,9,11,8,28,29,30,31,51,49,48,50,36,37,38,39,40,41,42,43,62,61,63,60,22,21,23,20,52,53,54,55,56,57,58,59,27,25,24,26],orientationDelta:l}},Ox:{CORNERS:{permutation:[16,19,17,18,4,5,6,7,8,9,10,11,0,2,3,1,28,30,31,29,20,21,22,23,24,25,26,27,12,15,13,14,32,33,34,35,52,54,55,53,36,39,37,38,44,45,46,47,48,49,50,51,56,59,57,58,40,42,43,41,60,61,62,63],orientationDelta:l}},Oy:{CORNERS:{permutation:[37,36,39,38,4,5,6,7,8,9,10,11,1,0,3,2,53,52,55,54,20,21,22,23,24,25,26,27,17,16,19,18,32,33,34,35,41,40,43,42,13,12,15,14,44,45,46,47,48,49,50,51,57,56,59,58,29,28,31,30,60,61,62,63],orientationDelta:l}},Oz:{CORNERS:{permutation:[19,17,16,18,4,5,6,7,8,9,10,11,30,29,31,28,54,53,55,52,20,21,22,23,24,25,26,27,59,57,56,58,32,33,34,35,2,1,3,0,15,13,12,14,44,45,46,47,48,49,50,51,39,37,36,38,42,41,43,40,60,61,62,63],orientationDelta:l}},U2:{CORNERS:{permutation:[40,41,42,43,44,45,46,47,32,33,34,35,36,37,38,39,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,8,9,10,11,12,13,14,15,0,1,2,3,4,5,6,7,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63],orientationDelta:l}},D2:{CORNERS:{permutation:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,56,57,58,59,60,61,62,63,48,49,50,51,52,53,54,55,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,24,25,26,27,28,29,30,31,16,17,18,19,20,21,22,23],orientationDelta:l}},F2:{CORNERS:{permutation:[52,53,54,55,48,49,50,51,8,9,10,11,12,13,14,15,36,37,38,39,32,33,34,35,24,25,26,27,28,29,30,31,20,21,22,23,16,17,18,19,40,41,42,43,44,45,46,47,4,5,6,7,0,1,2,3,56,57,58,59,60,61,62,63],orientationDelta:l}},B2:{CORNERS:{permutation:[0,1,2,3,4,5,6,7,60,61,62,63,56,57,58,59,16,17,18,19,20,21,22,23,44,45,46,47,40,41,42,43,32,33,34,35,36,37,38,39,28,29,30,31,24,25,26,27,48,49,50,51,52,53,54,55,12,13,14,15,8,9,10,11],orientationDelta:l}}},derivedMoves:{x:"Lx Rx",y2:"U2 D2",z2:"F2 B2"}},g=`<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 180 80" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<title>melindas2x2x2x2</title>
<defs>
  <g id="sticker-UL">
    <path d="m 0,0 10,0 -10,10 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
  <g id="sticker-UR">
    <path d="m 0,0 10,0 0,10 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
  <g id="sticker-DR">
    <path d="m 10,0 0,10 -10,0 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
  <g id="sticker-DL">
    <path d="m 00,0 10,10 -10,0 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
  <g id="squished-sticker-UL">
    <path d="m 0,0 5,0 -5,10 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
  <g id="squished-sticker-UR">
    <path d="m 0,0 5,0 0,10 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
  <g id="squished-sticker-DR">
    <path d="m 5,0 0,10 -5,0 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
  <g id="squished-sticker-DL">
    <path d="m 00,0 5,10 -5,0 z" stroke-width="0.75px" stroke="black" stroke-linecap="butt" stroke-linejoin="round" />
  </g>
</defs>
<g>
<g id="UL" transform="translate(45, 10)">
  <use id="CORNERS-l40-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: orange"/>
  <use id="CORNERS-l41-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: white"/>
  <use id="CORNERS-l45-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: white"/>
  <use id="CORNERS-l44-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: orange"/>
  <use id="CORNERS-l36-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: orange"/>
  <use id="CORNERS-l37-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: white"/>
  <use id="CORNERS-l33-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: white"/>
  <use id="CORNERS-l32-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: orange"/>
</g>
<g id="UR" transform="translate(65, 10)">
  <use id="CORNERS-l8-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: red"/>
  <use id="CORNERS-l9-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: white"/>
  <use id="CORNERS-l13-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: white"/>
  <use id="CORNERS-l12-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: red"/>
  <use id="CORNERS-l4-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: red"/>
  <use id="CORNERS-l5-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: white"/>
  <use id="CORNERS-l1-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: white"/>
  <use id="CORNERS-l0-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: red"/>
</g>

<g id="L" transform="translate(10, 35)">
  <use data-copy-id="CORNERS-l40-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: orange"/>
  <use id="CORNERS-l43-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: pink"/>
  <use id="CORNERS-l38-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: pink"/>
  <use data-copy-id="CORNERS-l36-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: orange"/>
  <use id="CORNERS-l56-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: orange"/>
  <use id="CORNERS-l58-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: pink"/>
  <use id="CORNERS-l55-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: pink"/>
  <use id="CORNERS-l52-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: orange"/>
</g>

<g id="FL" transform="translate(35, 35)">
  <use data-copy-id="CORNERS-l36-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: orange"/>
  <use id="CORNERS-l39-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: limegreen"/>
  <use id="CORNERS-l34-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: limegreen"/>
  <use data-copy-id="CORNERS-l32-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: orange"/>
  <use data-copy-id="CORNERS-l52-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: orange"/>
  <use id="CORNERS-l54-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: limegreen"/>
  <use id="CORNERS-l51-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: limegreen"/>
  <use id="CORNERS-l48-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: orange"/>
</g>
<g id="FR" transform="translate(75, 35)">
  <use data-copy-id="CORNERS-l4-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: red"/>
  <use id="CORNERS-l7-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: limegreen"/>
  <use id="CORNERS-l2-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: limegreen"/>
  <use data-copy-id="CORNERS-l0-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: red"/>
  <use id="CORNERS-l20-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: red"/>
  <use id="CORNERS-l22-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: limegreen"/>
  <use id="CORNERS-l19-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: limegreen"/>
  <use id="CORNERS-l16-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: red"/>
</g>

<g id="R" transform="translate(100, 35)">
  <use data-copy-id="CORNERS-l0-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: red"/>
  <use id="CORNERS-l3-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: pink"/>
  <use id="CORNERS-l14-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: pink"/>
  <use data-copy-id="CORNERS-l12-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: red"/>
  <use data-copy-id="CORNERS-l16-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: red"/>
  <use id="CORNERS-l18-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: pink"/>
  <use id="CORNERS-l31-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: pink"/>
  <use id="CORNERS-l28-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: red"/>
</g>

<g id="BR" transform="translate(125, 35)">
  <use data-copy-id="CORNERS-l12-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: red"/>
  <use id="CORNERS-l15-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: #26f"/>
  <use id="CORNERS-l10-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: #26f"/>
  <use data-copy-id="CORNERS-l8-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: red"/>
  <use data-copy-id="CORNERS-l28-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: red"/>
  <use id="CORNERS-l30-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: #26f"/>
  <use id="CORNERS-l27-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: #26f"/>
  <use id="CORNERS-l24-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: red"/>
</g>
<g id="BL" transform="translate(145, 35)">
  <use data-copy-id="CORNERS-l44-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: orange"/>
  <use id="CORNERS-l47-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: #26f"/>
  <use id="CORNERS-l42-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: #26f"/>
  <use data-copy-id="CORNERS-l40-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: orange"/>
  <use id="CORNERS-l60-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: orange"/>
  <use id="CORNERS-l62-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: #26f"/>
  <use id="CORNERS-l59-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: #26f"/>
  <use data-copy-id="CORNERS-l56-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: orange"/>
</g>

<g id="DL" transform="translate(45, 60)">
  <use data-copy-id="CORNERS-l52-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: orange"/>
  <use id="CORNERS-l53-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: yellow"/>
  <use id="CORNERS-l49-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: yellow"/>
  <use data-copy-id="CORNERS-l48-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: orange"/>
  <use data-copy-id="CORNERS-l56-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: orange"/>
  <use id="CORNERS-l57-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: yellow"/>
  <use id="CORNERS-l61-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: yellow"/>
  <use data-copy-id="CORNERS-l60-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: orange"/>
</g>
<g id="DR" transform="translate(65, 60)">
  <use data-copy-id="CORNERS-l20-o0" href="#sticker-UL" transform="translate( 0,  0)" style="fill: red"/>
  <use id="CORNERS-l21-o0" href="#sticker-DR" transform="translate( 0,  0)" style="fill: yellow"/>
  <use id="CORNERS-l17-o0" href="#sticker-DL" transform="translate(10,  0)" style="fill: yellow"/>
  <use data-copy-id="CORNERS-l16-o0" href="#sticker-UR" transform="translate(10,  0)" style="fill: red"/>
  <use data-copy-id="CORNERS-l24-o0" href="#sticker-DL" transform="translate( 0, 10)" style="fill: red"/>
  <use id="CORNERS-l25-o0" href="#sticker-UR" transform="translate( 0, 10)" style="fill: yellow"/>
  <use id="CORNERS-l29-o0" href="#sticker-UL" transform="translate(10, 10)" style="fill: yellow"/>
  <use data-copy-id="CORNERS-l28-o0" href="#sticker-DR" transform="translate(10, 10)" style="fill: red"/>
</g>

<g style="opacity: 0.3;">
<g id="IL" transform="translate(55, 35)">
  <use data-copy-id="CORNERS-l32-o0" href="#squished-sticker-UL" transform="translate( 0,  0)" style="fill: orange"/>
  <use id="CORNERS-l35-o0" href="#squished-sticker-DR" transform="translate( 0,  0)" style="fill: purple"/>
  <use id="CORNERS-l46-o0" href="#squished-sticker-DL" transform="translate(5,  0)" style="fill: purple"/>
  <use data-copy-id="CORNERS-l44-o0" href="#squished-sticker-UR" transform="translate(5,  0)" style="fill: orange"/>
  <use data-copy-id="CORNERS-l48-o0" href="#squished-sticker-DL" transform="translate( 0, 10)" style="fill: orange"/>
  <use id="CORNERS-l50-o0" href="#squished-sticker-UR" transform="translate( 0, 10)" style="fill: purple"/>
  <use id="CORNERS-l63-o0" href="#squished-sticker-UL" transform="translate(5, 10)" style="fill: purple"/>
  <use data-copy-id="CORNERS-l60-o0" href="#squished-sticker-DR" transform="translate(5, 10)" style="fill: orange"/>
</g>
<g id="IR" transform="translate(65, 35)">
  <use data-copy-id="CORNERS-l8-o0" href="#squished-sticker-UL" transform="translate( 0,  0)" style="fill: red"/>
  <use id="CORNERS-l11-o0" href="#squished-sticker-DR" transform="translate( 0,  0)" style="fill: purple"/>
  <use id="CORNERS-l6-o0" href="#squished-sticker-DL" transform="translate(5,  0)" style="fill: purple"/>
  <use data-copy-id="CORNERS-l4-o0" href="#squished-sticker-UR" transform="translate(5,  0)" style="fill: red"/>
  <use data-copy-id="CORNERS-l24-o0" href="#squished-sticker-DL" transform="translate( 0, 10)" style="fill: red"/>
  <use id="CORNERS-l26-o0" href="#squished-sticker-UR" transform="translate( 0, 10)" style="fill: purple"/>
  <use id="CORNERS-l23-o0" href="#squished-sticker-UL" transform="translate(5, 10)" style="fill: purple"/>
  <use data-copy-id="CORNERS-l20-o0" href="#squished-sticker-DR" transform="translate(5, 10)" style="fill: red"/>
</g>
</g>
</g>
</svg>`,m={name:"tri_quad",orbits:[{orbitName:"CORNERS",numPieces:5,numOrientations:3},{orbitName:"CORNER_U",numPieces:1,numOrientations:4},{orbitName:"CORNER_R",numPieces:1,numOrientations:3},{orbitName:"EDGES",numPieces:8,numOrientations:2},{orbitName:"BIG_CENTERS",numPieces:6,numOrientations:1},{orbitName:"SMALL_CENTERS",numPieces:13,numOrientations:3}],defaultPattern:{CORNERS:{pieces:[0,1,2,3,4],orientation:[0,0,0,0,0]},CORNER_U:{pieces:[0],orientation:[0]},CORNER_R:{pieces:[0],orientation:[0]},EDGES:{pieces:[0,1,2,3,4,5,6,7],orientation:[0,0,0,0,0,0,0,0]},BIG_CENTERS:{pieces:[0,1,2,3,4,5],orientation:[0,0,0,0,0,0]},SMALL_CENTERS:{pieces:[0,1,2,3,4,5,6,7,8,9,10,11,12],orientation:[0,0,0,0,0,0,0,0,0,0,0,0,0]}},moves:{U:{CORNERS:{permutation:[1,2,3,0,4],orientationDelta:[0,0,0,0,0]},CORNER_U:{permutation:[0],orientationDelta:[3]},CORNER_R:{permutation:[0],orientationDelta:[0]},EDGES:{permutation:[1,2,3,0,4,5,6,7],orientationDelta:[0,0,0,0,0,0,0,0]},BIG_CENTERS:{permutation:[1,2,3,0,4,5],orientationDelta:[0,0,0,0,0,0]},SMALL_CENTERS:{permutation:[2,3,4,5,6,7,0,1,8,9,10,11,12],orientationDelta:[0,0,0,0,0,0,0,0,0,0,0,0,0]}},R:{CORNERS:{permutation:[4,0,2,3,1],orientationDelta:[2,2,0,0,2]},CORNER_U:{permutation:[0],orientationDelta:[0]},CORNER_R:{permutation:[0],orientationDelta:[2]},EDGES:{permutation:[5,4,2,3,6,7,1,0],orientationDelta:[0,0,0,0,0,0,0,0]},BIG_CENTERS:{permutation:[4,1,2,3,5,0],orientationDelta:[0,0,0,0,0,0]},SMALL_CENTERS:{permutation:[9,8,7,3,4,5,6,12,10,11,1,0,2],orientationDelta:[0,0,0,0,0,0,0,0,0,0,0,0,0]}}}},u=`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="320"
   height="250"
   viewBox="0 0 84.666665 66.145831"
   version="1.1"
   id="svg5"
   inkscape:version="1.2.2 (b0a84865, 2022-12-01)"
   sodipodi:docname="TriQuad.svg"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview7"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     showgrid="false"
     inkscape:zoom="2.8284271"
     inkscape:cx="202.93965"
     inkscape:cy="135.23417"
     inkscape:window-width="1728"
     inkscape:window-height="945"
     inkscape:window-x="0"
     inkscape:window-y="38"
     inkscape:window-maximized="0"
     inkscape:current-layer="layer1" />
  <defs
     id="defs2" />
  <g stroke="black" stroke-width="0.36px" >
    <rect
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       id="rect15738"
       width="11.707812"
       height="4.0348959"
       x="24.27552"
       y="16.734896" />
    <rect
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       id="rect15740"
       width="11.90625"
       height="3.6380208"
       x="24.606249"
       y="44.846874" />
    <rect
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       id="rect15742"
       width="3.96875"
       height="11.641666"
       x="43.65625"
       y="27.516666" />
    <rect
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       id="rect15744"
       width="10.318749"
       height="7.4744792"
       x="63.63229"
       y="42.664062" />
    <rect
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       id="rect15746"
       width="10.583333"
       height="8.2020836"
       x="65.021355"
       y="16.536459" />
    <rect
       style="fill:#000000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       id="rect15736"
       width="5.8869791"
       height="10.847917"
       x="13.295312"
       y="27.252083" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 26.625856,38.003684 8.676292,0.11123 -3.89321,-5.33926 z"
       id="CORNER_U-l0-o3" />
    <path
       id="BIG_CENTERS-l3-o0"
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 35.191134 37.892261 L 26.514661 38.22609 L 26.796297 45.144014 A 1.4187645 1.4461632 0 0 1 26.980782 45.131095 A 1.4187645 1.4461632 0 0 1 28.3993 46.577002 A 1.4187645 1.4461632 0 0 1 26.980782 48.023425 A 1.4187645 1.4461632 0 0 1 26.913603 48.020841 L 27.293424 57.358256 L 32.187699 57.469877 L 33.669263 47.813619 A 1.4187645 1.4461632 0 0 1 33.666679 47.812585 A 1.4187645 1.4461632 0 0 1 33.468758 47.726286 A 1.4187645 1.4461632 0 0 1 33.464624 47.723702 A 1.4187645 1.4461632 0 0 1 33.281689 47.606913 A 1.4187645 1.4461632 0 0 1 33.278589 47.604329 A 1.4187645 1.4461632 0 0 1 33.113741 47.458602 A 1.4187645 1.4461632 0 0 1 32.973698 47.28962 A 1.4187645 1.4461632 0 0 1 32.970597 47.284969 A 1.4187645 1.4461632 0 0 1 32.861043 47.100484 A 1.4187645 1.4461632 0 0 1 32.855876 47.091182 A 1.4187645 1.4461632 0 0 1 32.775777 46.892745 A 1.4187645 1.4461632 0 0 1 32.773193 46.88396 A 1.4187645 1.4461632 0 0 1 32.724618 46.678288 A 1.4187645 1.4461632 0 0 1 32.722034 46.663818 A 1.4187645 1.4461632 0 0 1 32.705497 46.44471 A 1.4187645 1.4461632 0 0 1 32.725651 46.205448 A 1.4187645 1.4461632 0 0 1 32.729785 46.184261 A 1.4187645 1.4461632 0 0 1 32.78818 45.962052 A 1.4187645 1.4461632 0 0 1 32.792314 45.950167 A 1.4187645 1.4461632 0 0 1 32.892049 45.728992 A 1.4187645 1.4461632 0 0 1 33.030025 45.52487 A 1.4187645 1.4461632 0 0 1 33.032609 45.522286 A 1.4187645 1.4461632 0 0 1 33.19849 45.350203 A 1.4187645 1.4461632 0 0 1 33.206759 45.342969 A 1.4187645 1.4461632 0 0 1 33.401579 45.201375 A 1.4187645 1.4461632 0 0 1 33.857365 45.025675 A 1.4187645 1.4461632 0 0 1 34.100761 44.999837 L 35.191134 37.892261 z " />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 32.410048,57.136014 5.89543,0.44494 2.8921,-12.5695 -7.00778,-1.44605 z"
       id="SMALL_CENTERS-l7-o0" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 35.524618,38.337384 -1.00111,5.00555 6.67407,1.55729 z"
       id="EDGES-l0-o1" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 38.305478,57.247244 3.00333,-11.79085 4.78308,5.78419 z"
       id="CORNERS-l0-o2" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 22.51018,57.358484 -3.003333,-12.5695 7.119009,-1.44605 0.667406,14.23802 z"
       id="SMALL_CENTERS-l6-o0" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 16.442944,47.349782 22.51018,57.358484 19.395614,44.900224 Z"
       id="CORNERS-l3-o1"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 19.506848,44.566524 6.896539,-6.67407 -0.111236,5.56172 z"
       id="EDGES-l3-o0" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 29.295488,64.255014 -6.674074,-6.89653 h 9.677404 l 0.3337,4.11567 z"
       id="path999"
       sodipodi:nodetypes="ccccc" />
    <path
       style="fill:#ffff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 32.521288,61.362924 -0.11124,-3.89321 5.45049,0.11124 z"
       id="EDGES-l4-o0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 26.848325,27.509764 8.676293,-0.11123 -3.89321,5.33926 z"
       id="CORNER_U-l0-o1" />
    <path
       id="BIG_CENTERS-l1-o0"
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 32.409908 8.0439535 L 27.515633 8.1550578 L 27.124959 17.753955 A 1.4187645 1.4461632 0 0 1 28.3993 19.192627 A 1.4187645 1.4461632 0 0 1 27.007654 20.638017 L 26.736869 27.287223 L 35.413342 27.621053 L 34.305916 20.403923 A 1.4187645 1.4461632 0 0 1 33.99224 20.440613 A 1.4187645 1.4461632 0 0 1 32.573206 18.994189 A 1.4187645 1.4461632 0 0 1 33.868734 17.553967 L 32.409908 8.0439535 z " />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 32.632518,8.3774337 5.89543,-0.44494 2.8921,12.5695003 -7.00778,1.44605 z"
       id="SMALL_CENTERS-l2-o0" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 35.747088,27.176064 -1.00111,-5.00555 6.67407,-1.55729 z"
       id="EDGES-l1-o0" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 38.527948,8.2662037 3.00333,11.7908503 4.78308,-5.78419 z"
       id="CORNERS-l1-o1" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 22.732649,8.1549637 -3.003333,12.5695003 7.119009,1.44605 0.667403,-14.2380203 z"
       id="SMALL_CENTERS-l3-o0" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 16.665413,18.631388 22.732649,8.1549637 19.618083,21.548667 Z"
       id="CORNERS-l2-o2"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 19.729317,20.946924 6.896539,6.67407 -0.111236,-5.56172 z"
       id="EDGES-l2-o1" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 29.517958,1.2584335 22.843883,8.154963 h 9.677405 l 0.3337,-4.1156695 z"
       id="path1220"
       sodipodi:nodetypes="ccccc" />
    <path
       style="fill:#8800dd;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 32.743758,4.1505235 -0.11124,3.8932095 5.45049,-0.11124 z"
       id="EDGES-l7-o1"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 25.457888,37.131548 -0.11123,-8.676293 5.33926,3.89321 z"
       id="CORNER_U-l0-o2" />
    <path
       id="BIG_CENTERS-l2-o0"
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 25.568982 28.566732 L 17.670239 29.778544 A 1.4187645 1.4461632 0 0 1 17.683675 29.974398 A 1.4187645 1.4461632 0 0 1 16.265157 31.420821 A 1.4187645 1.4461632 0 0 1 14.865759 30.208492 L 5.9918823 31.569649 L 6.1029867 36.463924 L 15.111739 36.830827 A 1.4187645 1.4461632 0 0 1 16.52974 35.407658 A 1.4187645 1.4461632 0 0 1 17.948258 36.853564 A 1.4187645 1.4461632 0 0 1 17.944641 36.946065 L 25.235669 37.242688 L 25.568982 28.566732 z " />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 6.3255586,31.347355 -0.44494,-5.89543 12.5694994,-2.8921 1.44605,7.00778 z"
       id="SMALL_CENTERS-l4-o0" />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 25.124188,28.232785 -5.00555,1.00111 -1.55729,-6.67407 z"
       id="EDGES-l2-o0" />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 6.2143286,25.451925 19.12771,21.980873 16.804661,19.255769 Z"
       id="CORNERS-l2-o1"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 6.1030886,41.247224 18.672588,44.250557 20.118638,37.131548 5.8806186,36.464145 Z"
       id="SMALL_CENTERS-l5-o0" />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 16.766601,46.846738 6.1030886,41.247224 18.561348,44.36179 Z"
       id="CORNERS-l3-o2"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 18.895048,44.250556 6.67407,-6.896539 -5.56172,0.111236 z"
       id="EDGES-l3-o1" />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 37.339636,37.020296 0.11123,-8.676293 -5.33926,3.89321 z"
       id="CORNER_U-l0-o0" />
    <path
       id="BIG_CENTERS-l0-o0"
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 37.228219 28.455111 L 37.562048 37.131584 L 44.151827 36.863383 A 1.4187645 1.4461632 0 0 1 44.148726 36.787419 A 1.4187645 1.4461632 0 0 1 45.567761 35.341512 A 1.4187645 1.4461632 0 0 1 46.985763 36.748145 L 56.694214 36.35282 L 56.805835 31.458545 L 46.577519 29.889132 A 1.4187645 1.4461632 0 0 1 45.170886 31.156238 A 1.4187645 1.4461632 0 0 1 43.751851 29.709814 A 1.4187645 1.4461632 0 0 1 43.774072 29.459184 L 37.228219 28.455111 z " />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 56.471966,31.236103 0.44494,-5.89543 -12.5695,-2.8921 -1.44605,7.00778 z"
       id="SMALL_CENTERS-l1-o0" />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 37.673336,28.121533 5.00555,1.00111 1.55729,-6.67407 z"
       id="EDGES-l1-o1" />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 56.583196,25.340673 -11.79085,-3.00333 5.78419,-4.78308 z"
       id="CORNERS-l1-o2" />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 56.694436,41.135972 -12.5695,3.003333 -1.44605,-7.119009 14.23802,-0.667403 z"
       id="SMALL_CENTERS-l0-o0" />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 48.463076,48.699917 8.23136,-7.563945 -12.45826,3.114566 z"
       id="CORNERS-l0-o1" />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 43.902476,44.139304 -6.67407,-6.896539 5.56172,0.111236 z"
       id="EDGES-l0-o0" />
    <path
       id="BIG_CENTERS-l4-o0"
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 66.084338 35.995219 L 61.806047 38.374919 L 65.131942 46.747534 A 1.4187645 1.4461632 0 0 1 65.411511 46.718595 A 1.4187645 1.4461632 0 0 1 66.830029 48.164502 A 1.4187645 1.4461632 0 0 1 66.177873 49.380448 L 69.118262 56.782064 L 76.433577 52.105347 L 72.678251 46.259709 A 1.4187645 1.4461632 0 0 1 71.893803 46.502071 A 1.4187645 1.4461632 0 0 1 70.474768 45.055648 A 1.4187645 1.4461632 0 0 1 71.124858 43.841252 L 66.084338 35.995219 z " />
    <path
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 61.782948,38.775304 -5.31064,2.5983 3.8633,12.30575 6.77659,-2.29738 z"
       id="SMALL_CENTERS-l8-o0" />
    <path
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 68.605258,56.567014 -1.6684,-4.82433 -6.54498,2.03262 z"
       id="EDGES-l4-o1" />
    <path
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 56.641118,41.661474 3.37348,11.69033 -7.05188,-2.57016 z"
       id="CORNERS-l0-o0" />
    <path
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 70.210328,33.575674 8.94888,9.32363 -5.4096,4.84846 -7.77783,-11.94454 z"
       id="SMALL_CENTERS-l9-o0" />
    <path
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 76.864042,34.005903 -6.653714,-0.430229 8.98856,9.1714 z"
       id="CORNERS-l4-o2"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 79.271738,43.091204 -2.57317,9.24577 -2.71737,-4.85397 z"
       id="EDGES-l5-o0" />
    <path
       id="BIG_CENTERS-l5-o0"
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 71.530001 11.491805 L 68.202039 17.076994 A 1.4187645 1.4461632 0 0 1 68.814404 18.266585 A 1.4187645 1.4461632 0 0 1 67.395886 19.713009 A 1.4187645 1.4461632 0 0 1 66.731844 19.54351 L 61.728015 27.941447 L 65.766528 30.70872 L 72.055033 23.685893 A 1.4187645 1.4461632 0 0 1 71.533101 22.566064 A 1.4187645 1.4461632 0 0 1 72.952136 21.120158 A 1.4187645 1.4461632 0 0 1 73.964478 21.553206 L 78.979159 15.953031 L 71.530001 11.491805 z " />
    <path
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 66.135278,30.550754 4.69448,3.59388 9.29012,-8.94709 -5.0791,-5.04011 z"
       id="SMALL_CENTERS-l10-o0" />
    <path
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 79.015288,16.508154 -3.57346,3.64529 4.73882,4.95094 z"
       id="EDGES-l6-o1" />
    <path
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 71.012098,33.865134 8.95782,-8.23416 -3.12323,8.383912 z"
       id="CORNERS-l4-o1"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 57.722308,25.327844 4.35253,-12.16831 6.75248,2.67868 -7.2206,12.2894 z"
       id="SMALL_CENTERS-l11-o0" />
    <path
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 55.884858,14.300954 1.83745,11.02689 4.19858,-12.13592 z"
       id="CORNERS-l1-o0" />
    <path
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 62.196388,12.973214 9.42272,-1.82149 -3.13206,4.59732 z"
       id="EDGES-l7-o0" />
    <path
       style="fill:#ff0000;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 56.881638,40.784544 4.33814,-7.34148 -4.11567,-7.78641 z"
       id="CORNER_R-l0-o0" />
    <path
       style="fill:#00ff00;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 57.01393,41.025095 13.215848,-7.359561 -9.01,-0.3337 z"
       id="CORNER_R-l0-o1"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#2266ff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 57.549048,25.879124 3.44826,7.00777 8.89876,0.55617 z"
       id="CORNER_R-l0-o2" />
    <path
       style="fill:#ffffff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 76.795311,34.065104 3.241146,-8.73125 -0.79375,17.396354 z"
       id="CORNERS-l4-o0" />
    <path
       style="fill:#ffffff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 79.176561,42.531771 3.704167,1.653645 0.926041,-19.446874 -3.836458,0.727604 z"
       id="SMALL_CENTERS-l12-o0" />
    <path
       style="fill:#ffffff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 79.176561,42.664062 -2.315104,9.855729 6.151562,-8.334375 z"
       id="EDGES-l5-o1"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffffff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="m 80.168749,25.333854 -0.727604,-8.665104 4.43177,8.003646 z"
       id="EDGES-l6-o0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffffff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 22.357291,57.546875 16.594008,46.956087 6.4258814,41.831092 Z"
       id="CORNERS-l3-o0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffffff;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 22.555729,7.8713541 5.9581597,25.268988 16.594008,18.891116 Z"
       id="CORNERS-l2-o0"
       sodipodi:nodetypes="cccc" />
    <path
       style="fill:#ffa500;fill-opacity:1;stroke:#000000;stroke-width:0.35269;stroke-opacity:0.994007"
       d="M 5.8869791,25.598438 V 41.076562 L 1.0583333,33.866667 Z"
       id="path15317" />
    <path
       id="SMALL_CENTERS-l7-o2"
       style="fill:#000000"
       d="M 34.124532 44.998804 A 1.4187645 1.4461632 0 0 0 34.001025 45.004488 L 33.634123 47.8007 A 1.4187645 1.4461632 0 0 0 34.124532 47.891134 A 1.4187645 1.4461632 0 0 0 35.54305 46.44471 A 1.4187645 1.4461632 0 0 0 34.124532 44.998804 z " />
    <path
       id="SMALL_CENTERS-l7-o1"
       style="fill:#ffff00"
       d="M 32.906002 53.353333 L 32.530314 56.217757 A 1.4187645 1.4461632 0 0 0 32.669324 56.225509 A 1.4187645 1.4461632 0 0 0 34.087842 54.779085 A 1.4187645 1.4461632 0 0 0 32.906002 53.353333 z " />
    <path
       id="SMALL_CENTERS-l6-o1"
       style="fill:#000000"
       d="M 26.711031 45.158484 A 1.4187645 1.4461632 0 0 0 25.561747 46.577002 A 1.4187645 1.4461632 0 0 0 26.844873 48.015674 L 26.711031 45.158484 z " />
    <path
       id="SMALL_CENTERS-l6-o2"
       style="fill:#ffff00"
       d="M 27.072766 52.873775 A 1.4187645 1.4461632 0 0 0 25.760185 54.316064 A 1.4187645 1.4461632 0 0 0 27.17922 55.762488 A 1.4187645 1.4461632 0 0 0 27.208158 55.761454 L 27.072766 52.873775 z " />
    <path
       id="SMALL_CENTERS-l5-o1"
       style="fill:#ffa500"
       d="M 7.4383057 36.536788 A 1.4187645 1.4461632 0 0 0 8.8568237 37.969259 A 1.4187645 1.4461632 0 0 0 10.267074 36.669596 L 7.4383057 36.536788 z " />
    <path
       id="SMALL_CENTERS-l5-o2"
       style="fill:#000000"
       d="M 15.112256 36.896973 A 1.4187645 1.4461632 0 0 0 16.52974 38.299988 A 1.4187645 1.4461632 0 0 0 17.93689 37.029264 L 15.112256 36.896973 z " />
    <path
       id="SMALL_CENTERS-l4-o1"
       style="fill:#000000"
       d="M 16.265157 28.528491 A 1.4187645 1.4461632 0 0 0 14.846122 29.974398 A 1.4187645 1.4461632 0 0 0 14.86886 30.227096 L 17.679024 29.858643 A 1.4187645 1.4461632 0 0 0 16.265157 28.528491 z " />
    <path
       id="SMALL_CENTERS-l4-o2"
       style="fill:#ffa500"
       d="M 8.9229696 29.586825 A 1.4187645 1.4461632 0 0 0 7.5039347 31.032731 A 1.4187645 1.4461632 0 0 0 7.5137533 31.191895 L 10.325985 30.822925 A 1.4187645 1.4461632 0 0 0 8.9229696 29.586825 z " />
    <path
       id="SMALL_CENTERS-l3-o2"
       style="fill:#000000"
       d="M 26.980782 17.74672 A 1.4187645 1.4461632 0 0 0 25.561747 19.192627 A 1.4187645 1.4461632 0 0 0 26.920321 20.636466 L 27.055713 17.748271 A 1.4187645 1.4461632 0 0 0 26.980782 17.74672 z " />
    <path
       id="SMALL_CENTERS-l3-o1"
       style="fill:#8800dd"
       d="M 27.377657 9.7430745 A 1.4187645 1.4461632 0 0 0 25.958622 11.188981 A 1.4187645 1.4461632 0 0 0 27.295492 12.632304 L 27.430884 9.7435913 A 1.4187645 1.4461632 0 0 0 27.377657 9.7430745 z " />
    <path
       id="SMALL_CENTERS-l2-o2"
       style="fill:#8800dd"
       d="M 32.867761 9.8092204 A 1.4187645 1.4461632 0 0 0 32.820736 9.8107707 L 33.194356 12.661759 A 1.4187645 1.4461632 0 0 0 34.286279 11.255127 A 1.4187645 1.4461632 0 0 0 32.867761 9.8092204 z " />
    <path
       id="SMALL_CENTERS-l2-o1"
       style="fill:#000000"
       d="M 33.99224 17.548283 A 1.4187645 1.4461632 0 0 0 33.836694 17.557585 L 34.212382 20.422526 A 1.4187645 1.4461632 0 0 0 35.410758 18.994189 A 1.4187645 1.4461632 0 0 0 33.99224 17.548283 z " />
    <path
       id="SMALL_CENTERS-l1-o2"
       style="fill:#000000"
       d="M 45.170886 28.263908 A 1.4187645 1.4461632 0 0 0 43.759603 29.569255 L 46.571318 29.937708 A 1.4187645 1.4461632 0 0 0 46.589404 29.709814 A 1.4187645 1.4461632 0 0 0 45.170886 28.263908 z " />
    <path
       id="SMALL_CENTERS-l1-o1"
       style="fill:#ff0000"
       d="M 53.505261 29.322241 A 1.4187645 1.4461632 0 0 0 52.090361 30.661694 L 54.898975 31.030147 A 1.4187645 1.4461632 0 0 0 54.923779 30.768148 A 1.4187645 1.4461632 0 0 0 53.505261 29.322241 z " />
    <path
       id="SMALL_CENTERS-l0-o2"
       style="fill:#ff0000"
       d="M 55.642082 36.412764 L 52.842769 36.544023 A 1.4187645 1.4461632 0 0 0 54.232865 37.704675 A 1.4187645 1.4461632 0 0 0 55.642082 36.412764 z " />
    <path
       id="SMALL_CENTERS-l0-o1"
       style="fill:#000000"
       d="M 46.985246 36.818424 L 44.159062 36.951233 A 1.4187645 1.4461632 0 0 0 45.567761 38.233842 A 1.4187645 1.4461632 0 0 0 46.985246 36.818424 z " />
    <path
       id="SMALL_CENTERS-l8-o1"
       style="fill:#00ff00"
       d="M 62.328495 40.066288 A 1.4187645 1.4461632 0 0 0 61.412789 41.417627 A 1.4187645 1.4461632 0 0 0 62.831824 42.86405 A 1.4187645 1.4461632 0 0 0 63.449874 42.71884 L 62.328495 40.066288 z " />
    <path
       id="SMALL_CENTERS-l8-o2"
       style="fill:#000000"
       d="M 65.151579 46.743917 A 1.4187645 1.4461632 0 0 0 63.992476 48.164502 A 1.4187645 1.4461632 0 0 0 65.411511 49.610925 A 1.4187645 1.4461632 0 0 0 66.246086 49.332389 L 65.151579 46.743917 z " />
    <path
       id="SMALL_CENTERS-l9-o1"
       style="fill:#000000"
       d="M 71.893803 43.609741 A 1.4187645 1.4461632 0 0 0 71.182218 43.805078 L 72.747498 46.209066 A 1.4187645 1.4461632 0 0 0 73.312321 45.055648 A 1.4187645 1.4461632 0 0 0 71.893803 43.609741 z " />
    <path
       id="SMALL_CENTERS-l9-o2"
       style="fill:#00ff00"
       d="M 67.858907 37.259741 A 1.4187645 1.4461632 0 0 0 67.076526 37.500037 L 68.644906 39.908675 A 1.4187645 1.4461632 0 0 0 69.277425 38.705648 A 1.4187645 1.4461632 0 0 0 67.858907 37.259741 z " />
    <path
       id="SMALL_CENTERS-l10-o1"
       style="fill:#2266ff"
       d="M 68.77203 27.473258 L 66.907544 29.649353 A 1.4187645 1.4461632 0 0 0 67.792761 29.965613 A 1.4187645 1.4461632 0 0 0 69.211279 28.519189 A 1.4187645 1.4461632 0 0 0 68.77203 27.473258 z " />
    <path
       id="SMALL_CENTERS-l10-o2"
       style="fill:#000000"
       d="M 73.899365 21.489644 L 72.033329 23.667289 A 1.4187645 1.4461632 0 0 0 72.952136 24.012488 A 1.4187645 1.4461632 0 0 0 74.370654 22.566064 A 1.4187645 1.4461632 0 0 0 73.899365 21.489644 z " />
    <path
       id="SMALL_CENTERS-l11-o1"
       style="fill:#000000"
       d="M 67.395886 16.820679 A 1.4187645 1.4461632 0 0 0 65.976851 18.266585 A 1.4187645 1.4461632 0 0 0 66.670349 19.508887 L 68.128141 17.027901 A 1.4187645 1.4461632 0 0 0 67.395886 16.820679 z " />
    <path
       id="SMALL_CENTERS-l11-o2"
       style="fill:#2266ff"
       d="M 63.096407 24.361304 A 1.4187645 1.4461632 0 0 0 61.677372 25.80721 A 1.4187645 1.4461632 0 0 0 62.276819 26.986983 L 63.72996 24.513749 A 1.4187645 1.4461632 0 0 0 63.096407 24.361304 z " />
    <path
       id="SMALL_CENTERS-l12-o1"
       style="fill:#ffffff"
       d="M 83.706002 26.853658 A 1.2100496 1.2568218 0 0 0 82.512276 28.109912 A 1.2100496 1.2568218 0 0 0 83.586629 29.358415 L 83.706002 26.853658 z " />
    <path
       id="SMALL_CENTERS-l12-o2"
       style="fill:#ffffff"
       d="M 83.135494 38.833805 A 1.2100496 1.2568218 0 0 0 82.044604 40.083858 A 1.2100496 1.2568218 0 0 0 83.017155 41.315308 L 83.135494 38.833805 z " />
  </g>
</svg>
`;export{d as clockJSON,y as clockSVG,n as cube2x2x2JSON,a as cube2x2x2LLSVG,f as cube2x2x2SVG,E as melindas2x2x2x2OrbitJSON,g as melindas2x2x2x2OrbitSVG,h as pyraminxSVG,p as sq1HyperOrbitJSON,S as sq1HyperOrbitSVG,m as triQuadJSON,u as triQuadSVG};
