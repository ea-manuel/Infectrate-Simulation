let agents = [];
let S_history = [];
let I_history = [];
let R_history = [];
let D_history = [];
let B_history = [];
let t_history = [];
let t = 0;
let bisectionDone = false;
let simulationStarted = false;

// Parameters (Ghana-based defaults)
let beta = 0.2; // Infection rate (per day)
let gamma = 0.067; // Recovery rate (per day, ~15 days)
const mu = 0.05; // Death rate (per day)
const infectionRadius = 10; // Infection radius
const bacteriaSpawnRate = 1; // Bacteria spawned per day per infected
const bacteriaLifespan = 1; // Bacteria lifespan in days
let numSusceptible = 95; // N - I0
let numInfected = 5;
const simDuration = 30; // 30 days
const realTimeDuration = 60; // 60 seconds
const dt = simDuration / (realTimeDuration * 60); // Time step (60 FPS)
const moveSpeed = 3; // Pixels per frame
const chaseFleeWeight = 0.3; // 30% chase/flee, 70% random
const centralWidth = 600; // Central region width
const centralHeight = 400; // Central region height

// Sprite and background variables
let susceptibleImg, infectedImg, recoveredImg, tombstoneImg, bacteriaImg, bgImg;

function preload() {
  // Load PNG images
  susceptibleImg = loadImage('susceptible.png');
  infectedImg = loadImage('infected.png');
  recoveredImg = loadImage('recovered.png');
  tombstoneImg = loadImage('tombstone.png');
  bacteriaImg = loadImage('bacteria.webp');
  bgImg = loadImage('background.jpg');
}

function startSimulation() {
  // Read user inputs
  beta = parseFloat(document.getElementById('beta').value) || 0.2;
  gamma = parseFloat(document.getElementById('gamma').value) || 0.067;
  let population = parseInt(document.getElementById('population').value) || 100;
  numInfected = parseInt(document.getElementById('initialInfected').value) || 5;
  numSusceptible = population - numInfected;
  if (numInfected > population) {
    numInfected = population;
    numSusceptible = 0;
  }
  // Clear previous simulation
  agents = [];
  S_history = [numSusceptible];
  I_history = [numInfected];
  R_history = [0];
  D_history = [0];
  B_history = [0];
  t_history = [0];
  t = 0;
  bisectionDone = false;
  // Initialize agents
  let centerX = windowWidth / 2;
  let centerY = windowHeight / 2;
  for (let i = 0; i < numSusceptible; i++) {
    agents.push({
      x: centerX + random(-centralWidth / 2, centralWidth / 2),
      y: centerY + random(-centralHeight / 2, centralHeight / 2),
      state: 0 // Susceptible
    });
  }
  for (let i = 0; i < numInfected; i++) {
    agents.push({
      x: centerX + random(-centralWidth / 2, centralWidth / 2),
      y: centerY + random(-centralHeight / 2, centralHeight / 2),
      state: 1 // Infected
    });
  }
  simulationStarted = true;
  document.getElementById('inputForm').style.display = 'none';
  loop();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  noLoop();
}

function si_equal(t_val) {
  if (!t_history.length || t_val < 0 || t_val > t_history[t_history.length - 1]) {
    return 1e6;
  }
  let idx = Math.min(t_history.length - 1, Math.floor(t_val / dt));
  if (idx < t_history.length - 1) {
    let t0 = t_history[idx], t1 = t_history[idx + 1];
    let s0 = S_history[idx], s1 = S_history[idx + 1];
    let i0 = I_history[idx], i1 = I_history[idx + 1];
    let frac = (t_val - t0) / (t1 - t0);
    let S_val = s0 + (s1 - s0) * frac;
    let I_val = i0 + (i1 - i0) * frac;
    return I_val - S_val;
  }
  return I_history[idx] - S_history[idx];
}

function draw() {
  if (!simulationStarted || t >= simDuration) {
    noLoop();
    return;
  }
  background(bgImg);

  // Count populations
  let S = agents.filter(a => a.state === 0).length;
  let I = agents.filter(a => a.state === 1).length;
  let R = agents.filter(a => a.state === 2).length;
  let D = agents.filter(a => a.state === 3).length;
  let B = agents.filter(a => a.state === 4).length;

  // Spawn bacteria from infected
  for (let a of agents) {
    if (a.state === 1 && random() < bacteriaSpawnRate * dt) {
      agents.push({
        x: a.x + random(-5, 5),
        y: a.y + random(-5, 5),
        state: 4, // Bacteria
        age: 0 // Track lifespan
      });
    }
  }

  // Update agents
  let newStates = [];
  for (let a of agents) {
    if (a.state === 0) { // Susceptible
      let infected = false;
      for (let b of agents) {
        if (b.state === 4) { // Bacteria
          let dist = sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (dist < infectionRadius && random() < beta * dt) {
            newStates.push(1);
            infected = true;
            break;
          }
        }
      }
      if (!infected) {
        newStates.push(0);
      }
    } else if (a.state === 1) { // Infected
      if (random() < gamma * dt) {
        newStates.push(2); // Recover
      } else if (random() < mu * dt) {
        newStates.push(3); // Die
      } else {
        newStates.push(1);
      }
    } else if (a.state === 4) { // Bacteria
      a.age = (a.age || 0) + dt;
      if (a.age < bacteriaLifespan) {
        newStates.push(4);
      } else {
        newStates.push(-1); // Mark for removal
      }
    } else { // Recovered or Dead
      newStates.push(a.state);
    }
  }

  // Apply state changes and remove dead bacteria
  let newAgents = [];
  for (let i = 0; i < agents.length; i++) {
    agents[i].state = newStates[i];
    if (agents[i].state !== -1) {
      newAgents.push(agents[i]);
    }
  }
  agents = newAgents;

  // Move agents
  let centerX = windowWidth / 2;
  let centerY = windowHeight / 2;
  for (let a of agents) {
    if (a.state === 2 || a.state === 3) continue; // Recovered and Dead don't move

    let dx = random(-moveSpeed, moveSpeed);
    let dy = random(-moveSpeed, moveSpeed);

    if (a.state === 1) { // Infected: chase susceptible
      let nearestSusceptible = null;
      let minDist = Infinity;
      for (let s of agents) {
        if (s.state === 0) {
          let dist = sqrt((a.x - s.x) ** 2 + (a.y - s.y) ** 2);
          if (dist < minDist) {
            minDist = dist;
            nearestSusceptible = s;
          }
        }
      }
      if (nearestSusceptible) {
        let chaseDx = nearestSusceptible.x - a.x;
        let chaseDy = nearestSusceptible.y - a.y;
        let mag = sqrt(chaseDx * chaseDx + chaseDy * chaseDy);
        if (mag > 0) {
          dx = 0.7 * dx + 0.3 * (chaseDx / mag) * moveSpeed;
          dy = 0.7 * dy + 0.3 * (chaseDy / mag) * moveSpeed;
        }
      }
    } else if (a.state === 0) { // Susceptible: flee bacteria
      let nearestBacteria = null;
      let minDist = Infinity;
      for (let b of agents) {
        if (b.state === 4) {
          let dist = sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (dist < minDist) {
            minDist = dist;
            nearestBacteria = b;
          }
        }
      }
      if (nearestBacteria) {
        let fleeDx = a.x - nearestBacteria.x;
        let fleeDy = a.y - nearestBacteria.y;
        let mag = sqrt(fleeDx * fleeDx + fleeDy * fleeDy);
        if (mag > 0) {
          dx = 0.7 * dx + 0.3 * (fleeDx / mag) * moveSpeed;
          dy = 0.7 * dy + 0.3 * (fleeDy / mag) * moveSpeed;
        }
      }
    } else if (a.state === 4) { // Bacteria: random movement
      // Already set to random
    }
    // Apply movement
    a.x += dx;
    a.y += dy;
    // Keep within central region
    a.x = constrain(a.x, centerX - centralWidth / 2, centerX + centralWidth / 2);
    a.y = constrain(a.y, centerY - centralHeight / 2, centerY + centralHeight / 2);
  }

  // Draw agents
  for (let a of agents) {
    let img = a.state === 0 ? susceptibleImg : a.state === 1 ? infectedImg : a.state === 2 ? recoveredImg : a.state === 3 ? tombstoneImg : bacteriaImg;
    image(img, a.x - 30, a.y - 30, 60, 60);
  }

  // Display time and parameters
  textFont('Open Sans');
  textSize(18);
  fill(255, 255, 255, 200);
  let textLines = [
    `Day: ${t.toFixed(2)}`,
    `Susceptible: ${S}`,
    `Infected: ${I}`,
    `Recovered: ${R}`,
    `Dead: ${D}`,
    `Bacteria: ${B}`,
    '',
    'Parameters:',
    `Infection Rate (β): ${beta.toFixed(2)}/day`,
    `Recovery Rate (γ): ${gamma.toFixed(3)}/day`,
    `Death Rate (μ): ${mu.toFixed(4)}/day`,
    `Initial: ${numSusceptible + numInfected} people, ${numInfected} infected`
  ];
  for (let i = 0; i < textLines.length; i++) {
    text(textLines[i], 20, 30 + i * 25);
  }

  // Update history
  t += dt;
  S_history.push(S);
  I_history.push(I);
  R_history.push(R);
  D_history.push(D);
  B_history.push(B);
  t_history.push(t);

  // Numerical analysis
  if (t > 0.5 && t_history.length > 2) {
    // Trapezoidal rule
    let totalInfected = 0;
    for (let i = 1; i < t_history.length; i++) {
      totalInfected += (I_history[i] + I_history[i-1]) * (t_history[i] - t_history[i-1]) / 2;
    }
    console.log(`Total infected (integrated): ${totalInfected.toFixed(2)}`);

    // Central difference
    let dIdt = [];
    for (let i = 1; i < I_history.length - 1; i++) {
      dIdt.push((I_history[i+1] - I_history[i-1]) / (2 * (t_history[i+1] - t_history[i-1])));
    }
    let peakIdx = dIdt.indexOf(Math.max(...dIdt));
    console.log(`Peak infection rate at t=${t_history[peakIdx+1].toFixed(2)} days`);

    // Bisection
    if (!bisectionDone) {
      let a = 0, b = t, tol = 1e-5, maxIter = 100;
      for (let i = 0; i < maxIter; i++) {
        let c = (a + b) / 2;
        let fc = si_equal(c);
        if (Math.abs(fc) < tol || (b - a) / 2 < tol) {
          if (0 <= c && c <= t) {
            console.log(`Infected equal susceptible at t=${c.toFixed(2)} days`);
          } else {
            console.log("No time found where infected equal susceptible");
          }
          bisectionDone = true;
          break;
        }
        if (fc * si_equal(a) > 0) {
          a = c;
        } else {
          b = c;
        }
      }
    }
  }
}