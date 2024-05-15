import Sketch  from "react-p5";
import * as ms from '@magenta/sketch';
import React from "react";

// global setting
const BASE_URL =
      'https://storage.googleapis.com/quickdraw-models/sketchRNN/models/';
const availableModels = [
    'bird',
    'ant',
    'ambulance',
    'angel',
    'alarm_clock',
    'antyoga',
    'backpack',
    'barn',
    'basket',
    'bear',
    'bee',
    'beeflower',
    'bicycle',
    'book',
    'brain',
    'bridge',
    'bulldozer',
    'bus',
    'butterfly',
    'cactus',
    'calendar',
    'castle',
    'cat',
    'catbus',
    'catpig',
    'chair',
    'couch',
    'crab',
    'crabchair',
    'crabrabbitfacepig',
    'cruise_ship',
    'diving_board',
    'dog',
    'dogbunny',
    'dolphin',
    'duck',
    'elephant',
    'elephantpig',
    'everything',
    'eye',
    'face',
    'fan',
    'fire_hydrant',
    'firetruck',
    'flamingo',
    'flower',
    'floweryoga',
    'frog',
    'frogsofa',
    'garden',
    'hand',
    'hedgeberry',
    'hedgehog',
    'helicopter',
    'kangaroo',
    'key',
    'lantern',
    'lighthouse',
    'lion',
    'lionsheep',
    'lobster',
    'map',
    'mermaid',
    'monapassport',
    'monkey',
    'mosquito',
    'octopus',
    'owl',
    'paintbrush',
    'palm_tree',
    'parrot',
    'passport',
    'peas',
    'penguin',
    'pig',
    'pigsheep',
    'pineapple',
    'pool',
    'postcard',
    'power_outlet',
    'rabbit',
    'rabbitturtle',
    'radio',
    'radioface',
    'rain',
    'rhinoceros',
    'rifle',
    'roller_coaster',
    'sandwich',
    'scorpion',
    'sea_turtle',
    'sheep',
    'skull',
    'snail',
    'snowflake',
    'speedboat',
    'spider',
    'squirrel',
    'steak',
    'stove',
    'strawberry',
    'swan',
    'swing_set',
    'the_mona_lisa',
    'tiger',
    'toothbrush',
    'toothpaste',
    'tractor',
    'trombone',
    'truck',
    'whale',
    'windmill',
    'yoga',
    'yogabicycle',
];

const COLORS = [
    { name: 'black', hex: '#000000' },
    { name: 'red', hex: '#f44336' },
    { name: 'pink', hex: '#E91E63' },
    { name: 'purple', hex: '#9C27B0' },
    { name: 'deeppurple', hex: '#673AB7' },
    { name: 'indigo', hex: '#3F51B5' },
    { name: 'blue', hex: '#2196F3' },
    { name: 'cyan', hex: '#00BCD4' },
    { name: 'teal', hex: '#009688' },
    { name: 'green', hex: '#4CAF50' },
    { name: 'lightgreen', hex: '#8BC34A' },
    { name: 'lime', hex: '#CDDC39' },
    { name: 'yellow', hex: '#FFEB3B' },
    { name: 'amber', hex: '#FFC107' },
    { name: 'orange', hex: '#FF9800' },
    { name: 'deeporange', hex: '#FF5722' },
    { name: 'brown', hex: '#795548' },
    { name: 'grey', hex: '#9E9E9E' },
  ];

let model;

// Model
let modelState;
const temperature = 0.1; // Very low so that we draw very well.
let modelLoaded = false;
let modelIsActive = false;

// Model pen state.
let dx, dy;
let x, y;
let startX, startY; // Keep track of the first point of the last raw line.
let pen = [0, 0, 0]; // Model pen state, [pen_down, pen_up, pen_end].
let previousPen = [1, 0, 0]; // Previous model pen state.
const PEN = { DOWN: 0, UP: 1, END: 2 };
const epsilon = 2.0; // to ignore data from user's pen staying in one spot.

// Human drawing.
let currentRawLine = [];
let userPen = 0; // above = 0 or below = 1 the paper.
let previousUserPen = 0;
let currentColor = 'black';

// Keep track of everyone's last attempts to that we can reverse them.
let lastHumanStroke; // encode the human's drawing as a sequence of [dx, dy, penState] strokes
let lastHumanDrawing; // the actual sequence of lines that the human drew, so we can replay them.
let lastModelDrawing = []; // the actual sequence of lines that the model drew, so that we can erase them.

// Don't record mouse events when the splash is open.
let splashIsOpen = true;

let img;

// SketchPad component

export default function SketchPad() {

    const setup = (p5) => {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        p5.createCanvas(screenWidth, screenHeight);
        console.log("Canvas created!"); // 添加这行日志以确认是否创建了画布
        console.log(screenWidth, screenHeight);
        p5.frameRate(50);
        // restart(p5);
        initModel(22);

        // selectModels.inner
    };

    const draw = (p5) => {
        if (!modelLoaded || !modelIsActive) {
            return;
        }
    
        // New state.
        pen = previousPen;
        modelState = model.update([dx, dy, ...pen], modelState);
        const pdf = model.getPDF(modelState, temperature);
        [dx, dy, ...pen] = model.sample(pdf);
    
        // If we finished the previous drawing, start a new one.
        if (pen[PEN.END] === 1) {
        console.log('finished this one');
        modelIsActive = false;
        } else {
        // Only draw on the paper if the pen is still touching the paper.
        if (previousPen[PEN.DOWN] === 1) {
            p5.line(x, y, x + dx, y + dy);
            lastModelDrawing.push([x, y, x + dx, y + dy]);
        }
        // Update.
        x += dx;
        y += dy;
        previousPen = pen;
        }
    };

    const mouseReleased = (p5) => { //鼠标释放
        if (!splashIsOpen && p5.isInBounds()) {
            userPen = 0; // Up!
            const currentRawLineSimplified = model.simplifyLine(currentRawLine);
      
            // If it's an accident...ignore it.
            if (currentRawLineSimplified.length > 1) {
              // Encode this line as a stroke, and feed it to the model.
              lastHumanStroke = model.lineToStroke(currentRawLineSimplified, [
                startX,
                startY,
              ]);
              encodeStrokes(lastHumanStroke);
            }
            currentRawLine = [];
            previousUserPen = userPen;
          }
    };

    const mouseDragged = (p5) => {
        if (!splashIsOpen && !modelIsActive && p5.isInBounds()) {
            const dx0 = p5.mouseX - x;
            const dy0 = p5.mouseY - y;
            if (dx0 * dx0 + dy0 * dy0 > epsilon * epsilon) {
              // Only if pen is not in same area.
              dx = dx0;
              dy = dy0;
              userPen = 1;
              if (previousUserPen === 1) {
                p5.line(x, y, x + dx, y + dy); // draw line connecting prev point to current point.
                lastHumanDrawing.push([x, y, x + dx, y + dy]);
              }
              x += dx;
              y += dy;
              currentRawLine.push([x, y]);
            }
            previousUserPen = userPen;
          }
          return false;
    };

    const mousePressed = (p5) => {
        if (!splashIsOpen && p5.isInBounds()) {
            x = startX = p5.mouseX;
            y = startY = p5.mouseY;
            userPen = 1; // down!
      
            modelIsActive = false;
            currentRawLine = [];
            lastHumanDrawing = [];
            previousUserPen = userPen;
            p5.stroke(currentColor);
          }

    };

    return (<><Sketch setup={setup} draw={draw} mouseReleased={mouseReleased} mousePressed={mousePressed} mouseDragged={mouseDragged} /><div id="splash">
    {/* </div><div class="wrapper top">
            <div>
                <h1></h1>
            </div>
            <div class="controls">
                <button class="box" id="btnClear" alt="clear drawing">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0V0z" /><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z" /><path fill="none" d="M0 0h24v24H0z" /></svg>
                </button>
                <button class="box" id="btnRetry" alt="retry magic drawing">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none" /><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" /></svg>
                </button>
                <div class="box select-wrapper">
                    <select id="selectModels"></select>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /><path d="M0 0h24v24H0z" fill="none" /></svg>
                </div>

                <button class="box" id="btnSave" alt="save sketch">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none" /><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" /></svg>
                </button>
                <button class="box" id="btnHelp" alt="show help">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none" /><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg>
                </button>
            </div>
        </div><div class="wrapper"> */}
            {/* <div>
                <h1></h1>
            </div>
            <div id="colorsContainer">
                <button data-index="0" style="background-color: rgb(0, 0, 0)" class="active" onclick="changeColor(event)"></button>
                <button data-index="1" style="background-color: rgb(244, 67, 54)" onclick="changeColor(event)"></button>
                <button data-index="2" style="background-color: rgb(233, 30, 99)" onclick="changeColor(event)"></button>
                <button data-index="3" style="background-color: rgb(156, 39, 176)" onclick="changeColor(event)"></button>
                <button data-index="4" style="background-color: rgb(103, 58, 183)" onclick="changeColor(event)"></button>
                <button data-index="5" style="background-color: rgb(63, 81, 181)" onclick="changeColor(event)"></button>
                <button data-index="6" style="background-color: rgb(33, 150, 243)" onclick="changeColor(event)"></button>
                <button data-index="7" style="background-color: rgb(0, 188, 212)" onclick="changeColor(event)"></button>
                <button data-index="8" style="background-color: rgb(0, 150, 136)" onclick="changeColor(event)"></button>
                <button data-index="9" style="background-color: rgb(76, 175, 80)" onclick="changeColor(event)"></button>
                <button data-index="10" style="background-color: rgb(139, 195, 74)" onclick="changeColor(event)"></button>
                <button data-index="11" style="background-color: rgb(205, 220, 57)" onclick="changeColor(event)"></button>
                <button data-index="12" style="background-color: rgb(255, 235, 59)" onclick="changeColor(event)"></button>
                <button data-index="13" style="background-color: rgb(255, 193, 7)" onclick="changeColor(event)"></button>
                <button data-index="14" style="background-color: rgb(255, 152, 0)" onclick="changeColor(event)"></button>
                <button data-index="15" style="background-color: rgb(255, 87, 34)" onclick="changeColor(event)"></button>
                <button data-index="16" style="background-color: rgb(121, 85, 72)" onclick="changeColor(event)"></button>
                <button data-index="17" style="background-color: rgb(158, 158, 158)" onclick="changeColor(event)"></button>
            </div> */}
        </div><div id="sketch" ></div></>);

};

// helper function
// function retryMagic(p) {
//     p.stroke('white');
//     p.strokeWeight(6);

//     // Undo the previous line the model drew.
//     for (let i = 0; i < lastModelDrawing.length; i++) {
//       p.line(...lastModelDrawing[i]);
//     }

//     // Undo the previous human drawn.
//     for (let i = 0; i < lastHumanDrawing.length; i++) {
//       p.line(...lastHumanDrawing[i]);
//     }

//     p.strokeWeight(3.0);
//     p.stroke(currentColor);

//     // Redraw the human drawing.
//     for (let i = 0; i < lastHumanDrawing.length; i++) {
//       p.line(...lastHumanDrawing[i]);
//     }

//     // Start again.
//     encodeStrokes(lastHumanStroke);
//   }

//   function restart(p) {
//     // p.background(255, 255, 255, 0);
//     p.image(img, 0, 0, p.width, p.height);
//     // 图片的宽和高选一个小的作为定值
//     p.strokeWeight(3.0);

//     // Start drawing in the middle-ish of the screen
//     startX = x = p.width / 2.0;
//     startY = y = p.height / 3.0;

    // // Reset the user drawing state.
    // userPen = 1;
    // previousUserPen = 0;
    // currentRawLine = [];
    // strokes = [];

    // Reset the model drawing state.
//     modelIsActive = false;
//     previousPen = [0, 1, 0];
//   }

  function initModel(index) {
    modelLoaded = false;
    // document.getElementById('sketch').classList.add('loading');

    if (model) {
      model.dispose();
    }

    model = new ms.SketchRNN(`${BASE_URL}${availableModels[index]}.gen.json`);
    model.initialize().then(() => {
      modelLoaded = true;
    //   document.getElementById('sketch').classList.remove('loading');
      console.log(`🤖${availableModels[index]} loaded.`);
      model.setPixelFactor(5.0); // Bigger -> large outputs
    });
  }

  function encodeStrokes(sequence) {
    if (sequence.length <= 5) {
      return;
    }

    // Encode the strokes in the model.
    let newState = model.zeroState();
    newState = model.update(model.zeroInput(), newState);
    newState = model.updateStrokes(sequence, newState, sequence.length - 1);

    // Reset the actual model we're using to this one that has the encoded strokes.
    modelState = model.copyState(newState);

    const lastHumanLine = lastHumanDrawing[lastHumanDrawing.length - 1];
    x = lastHumanLine[0];
    y = lastHumanLine[1];

    // Update the pen state.
    const s = sequence[sequence.length - 1];
    dx = s[0];
    dy = s[1];
    previousPen = [s[2], s[3], s[4]];

    lastModelDrawing = [];
    modelIsActive = true;
  }

  function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)].hex;
  }
  function randomColorIndex() {
    return Math.floor(Math.random() * COLORS.length);
  }
