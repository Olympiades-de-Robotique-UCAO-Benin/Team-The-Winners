/**
 * LINE FOLLOWER ROBOT PID SIMULATOR
 * Designed for Team The Winners
 */

class LineFollowerSim {
  /** @type {HTMLCanvasElement|null} */
  canvas = null;
  /** @type {CanvasRenderingContext2D|null} */
  ctx = null;
  /** @type {number} */
  width = 800;
  /** @type {number} */
  height = 400;
  /** @type {{x: number, y: number, theta: number, wheelbase: number, sensorOffset: number, sensorSpacing: number, sensors: number[], sensorPositions: any[], trail: any[], maxTrail: number}} */
  robot = { x: 100, y: 100, theta: 0, wheelbase: 30, sensorOffset: 25, sensorSpacing: 6, sensors: [0,0,0,0,0], sensorPositions: [], trail: [], maxTrail: 150 };
  /** @type {{Kp: number, Ki: number, Kd: number, baseSpeed: number, dt: number}} */
  params = { Kp: 15.0, Ki: 0.05, Kd: 8.0, baseSpeed: 2.5, dt: 1.0 };
  /** @type {{lastError: number, integral: number}} */
  pid = { lastError: 0, integral: 0 };
  /** @type {boolean} */
  running = false;
  /** @type {string} */
  status = "INITIALISATION";
  /** @type {number} */
  lapCount = 0;
  /** @type {number} */
  crossLineCooldown = 0;
  /** @type {any[]} */
  trackPoints = [];
  /** @type {any} */
  telemetry = null;

  /**
   * @param {string} canvasId - The ID of the canvas element
   */
  constructor(canvasId) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) return;
    
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // Track Definition (Points representing the center of the track)
    this.trackPoints = [];
    this.generateTrack();
    
    // Reset robot to starting line
    this.resetRobot();
    
    // Start Animation Loop
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
  }
  
  generateTrack() {
    // Generate a smooth racetrack using a series of cubic curves and circles
    this.trackPoints = [];
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // A nice infinity-style track or complex oval with curves
    for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
      // Infinity curve (Lemniscate of Bernoulli) scaled to fit canvas
      const scale = 280;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const denominator = 1 + sinA * sinA;
      
      const tx = centerX + (scale * cosA) / denominator;
      const ty = centerY + (scale * cosA * sinA) / denominator;
      
      this.trackPoints.push({ x: tx, y: ty });
    }
  }
  
  resetRobot() {
    // Start at track point 0
    const startPoint = this.trackPoints[0];
    const nextPoint = this.trackPoints[1];
    
    this.robot.x = startPoint.x;
    this.robot.y = startPoint.y;
    this.robot.theta = Math.atan2(nextPoint.y - startPoint.y, nextPoint.x - startPoint.x);
    this.robot.trail = [];
    
    this.pid.lastError = 0;
    this.pid.integral = 0;
    this.lapCount = 0;
    this.status = "ARRÊTÉ";
  }
  
  start() {
    if (!this.running) {
      this.running = true;
      this.status = "SUIVI DE LIGNE";
      this.lastTime = performance.now();
      requestAnimationFrame(this.tick);
    }
  }
  
  stop() {
    this.running = false;
    this.status = "ARRÊTÉ";
  }
  
  /**
   * @param {string | number} kp - Proportional gain
   * @param {string | number} ki - Integral gain
   * @param {string | number} kd - Derivative gain
   * @param {string | number} speed - Base speed
   */
  setParams(kp, ki, kd, speed) {
    this.params.Kp = parseFloat(String(kp));
    this.params.Ki = parseFloat(String(ki));
    this.params.Kd = parseFloat(String(kd));
    this.params.baseSpeed = parseFloat(String(speed));
  }
  
  /**
   * Find shortest distance from a point to the track line
   * @param {number} px - Point X coordinate
   * @param {number} py - Point Y coordinate
   * @returns {{distance: number, index: number}} Minimum distance and closest index
   */
  getDistanceFromLine(px, py) {
    let minDistance = Infinity;
    let closestIndex = -1;
    
    // Find closest waypoint on track
    for (let i = 0; i < this.trackPoints.length; i++) {
      const pt = this.trackPoints[i];
      const dx = px - pt.x;
      const dy = py - pt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }
    
    return { distance: minDistance, index: closestIndex };
  }
  
  // Calculate sensor coordinates based on robot position and heading
  updateSensors() {
    const r = this.robot;
    const offsetAngle = r.theta;
    
    // Sensor board center position
    const scx = r.x + r.sensorOffset * Math.cos(offsetAngle);
    const scy = r.y + r.sensorOffset * Math.sin(offsetAngle);
    
    // Individual sensor positions (perpendicular line to heading)
    r.sensorPositions = [];
    const sensorWeights = [-2, -1, 0, 1, 2];
    
    for (let i = 0; i < 5; i++) {
      const spacingIndex = sensorWeights[i];
      const sensorAngle = offsetAngle + Math.PI / 2;
      
      const sx = scx + spacingIndex * r.sensorSpacing * Math.cos(sensorAngle);
      const sy = scy + spacingIndex * r.sensorSpacing * Math.sin(sensorAngle);
      
      r.sensorPositions.push({ x: sx, y: sy });
      
      // Read line value at this sensor (line width is ~12px)
      const res = this.getDistanceFromLine(sx, sy);
      if (res.distance < 12) {
        // Linear drop-off intensity representing analog IR sensor
        r.sensors[i] = 1 - (res.distance / 12);
      } else {
        r.sensors[i] = 0;
      }
    }
  }
  
  updatePhysics() {
    if (!this.running) return;
    
    const r = this.robot;
    const p = this.params;
    
    // Update sensor readings
    this.updateSensors();
    
    // PID error calculation
    // Weighted error based on sensor indices: L2 (-2), L1 (-1), C (0), R1 (1), R2 (2)
    let sumWeight = 0;
    let sumSensors = 0;
    
    const weights = [-2, -1, 0, 1, 2];
    for (let i = 0; i < 5; i++) {
      sumWeight += weights[i] * r.sensors[i];
      sumSensors += r.sensors[i];
    }
    
    let error = 0;
    if (sumSensors > 0.05) {
      error = sumWeight / sumSensors;
      this.status = "SUIVI DE LIGNE";
    } else {
      // If no sensors detect the line, use last known error with a penalty
      error = this.pid.lastError > 0 ? 2.5 : -2.5;
      this.status = "RECHERCHE LIGNE";
    }
    
    // If the robot deviates way too far, it's out of bounds
    const centerDist = this.getDistanceFromLine(r.x, r.y).distance;
    if (centerDist > 65) {
      this.status = "SORTIE DE PISTE";
      this.running = false;
      return;
    }
    
    // PID Control Loop
    const errorDiff = error - this.pid.lastError;
    this.pid.integral += error * p.dt;
    // Cap integral to avoid windup
    this.pid.integral = Math.max(-10, Math.min(10, this.pid.integral));
    
    const correction = (p.Kp * error) + (p.Ki * this.pid.integral) + (p.Kd * errorDiff);
    this.pid.lastError = error;
    
    // Adjust differential motor speeds
    const leftSpeed = p.baseSpeed + correction;
    const rightSpeed = p.baseSpeed - correction;
    
    // Calculate robot movement
    const avgSpeed = (leftSpeed + rightSpeed) / 2;
    const turningRate = (leftSpeed - rightSpeed) / r.wheelbase;
    
    r.theta += turningRate * p.dt;
    r.x += avgSpeed * Math.cos(r.theta) * p.dt;
    r.y += avgSpeed * Math.sin(r.theta) * p.dt;
    
    // Track telemetry variables for display
    this.telemetry = {
      error: error.toFixed(2),
      correction: correction.toFixed(2),
      leftSpeed: leftSpeed.toFixed(2),
      rightSpeed: rightSpeed.toFixed(2),
      leftPWM: Math.round(Math.min(255, Math.max(0, leftSpeed * 50))),
      rightPWM: Math.round(Math.min(255, Math.max(0, rightSpeed * 50))),
      x: Math.round(r.x),
      y: Math.round(r.y)
    };
    
    // Save breadcrumbs for trail
    r.trail.push({ x: r.x, y: r.y });
    if (r.trail.length > r.maxTrail) {
      r.trail.shift();
    }
    
    // Check for Start/Finish line cross (at index 0 of track points)
    const distToStart = Math.hypot(r.x - this.trackPoints[0].x, r.y - this.trackPoints[0].y);
    if (this.crossLineCooldown > 0) {
      this.crossLineCooldown--;
    } else if (distToStart < 15) {
      this.lapCount++;
      this.crossLineCooldown = 100; // block repeat counts
      this.status = `TOUR COMPLÉTÉ (${this.lapCount})`;
    }
  }
  
  draw() {
    const ctx = this.ctx;
    const r = this.robot;
    
    // 1. Clear Screen
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 2. Draw grid lines
    ctx.strokeStyle = 'rgba(0, 71, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    
    // 3. Draw Track
    ctx.beginPath();
    ctx.strokeStyle = '#1e2040';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < this.trackPoints.length; i++) {
      const pt = this.trackPoints[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();
    
    // Draw neon glowing inner track line
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00f0ff';
    for (let i = 0; i < this.trackPoints.length; i++) {
      const pt = this.trackPoints[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow
    
    // Draw start line crossbar
    const startPt = this.trackPoints[0];
    const angle = Math.atan2(this.trackPoints[5].y - startPt.y, this.trackPoints[5].x - startPt.x);
    ctx.save();
    ctx.translate(startPt.x, startPt.y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(15, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '7px monospace';
    ctx.fillText("START / FINISH", -25, -5);
    ctx.restore();
    
    // 4. Draw Trail
    if (r.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 71, 255, 0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < r.trail.length; i++) {
        const pt = r.trail[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    
    // 5. Draw Robot Chassis
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.theta);
    
    // Robot body (sleek glassmorphic panel)
    ctx.fillStyle = 'rgba(11, 12, 30, 0.9)';
    ctx.strokeStyle = '#0047ff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#0047ff';
    
    // Draw rectangular body
    ctx.beginPath();
    ctx.rect(-18, -12, 36, 24);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Wheels (Left & Right)
    ctx.fillStyle = '#020205';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    // Left wheel
    ctx.fillRect(-8, -15, 16, 3);
    ctx.strokeRect(-8, -15, 16, 3);
    // Right wheel
    ctx.fillRect(-8, 12, 16, 3);
    ctx.strokeRect(-8, 12, 16, 3);
    
    // Castor Wheel (Front)
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.arc(12, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Sensor board extension
    ctx.fillStyle = '#07070f';
    ctx.strokeStyle = '#00f0ff';
    ctx.beginPath();
    ctx.rect(r.sensorOffset - 4, -15, 6, 30);
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
    
    // 6. Draw individual sensor points and connection beams
    if (r.sensorPositions.length > 0) {
      for (let i = 0; i < r.sensorPositions.length; i++) {
        const sx = r.sensorPositions[i].x;
        const sy = r.sensorPositions[i].y;
        const value = r.sensors[i];
        
        // Sensor beam to ground
        ctx.beginPath();
        ctx.strokeStyle = value > 0.5 ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        
        // Sensor LED dot
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = value > 0.5 ? '#00f0ff' : '#666666';
        ctx.shadowBlur = value > 0.5 ? 6 : 0;
        ctx.shadowColor = '#00f0ff';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
  
  tick() {
    this.updatePhysics();
    this.draw();
    
    // Update DOM elements if available
    this.updateUI();
    
    if (this.running) {
      requestAnimationFrame(this.tick);
    }
  }
  
  updateUI() {
    const statusEl = document.getElementById('sim-status');
    const lapEl = document.getElementById('sim-laps');
    const errEl = document.getElementById('sim-error');
    const corrEl = document.getElementById('sim-corr');
    const pwmLeftEl = document.getElementById('sim-pwm-left');
    const pwmRightEl = document.getElementById('sim-pwm-right');
    
    if (statusEl) {
      statusEl.textContent = this.status;
      statusEl.className = 'val ' + (this.status.includes('SORTIE') ? 'error' : this.status.includes('TOUR') ? 'success' : 'info');
    }
    if (lapEl) lapEl.textContent = this.lapCount;
    
    if (this.telemetry) {
      if (errEl) errEl.textContent = this.telemetry.error;
      if (corrEl) corrEl.textContent = this.telemetry.correction;
      if (pwmLeftEl) pwmLeftEl.textContent = this.telemetry.leftPWM + ' / 255';
      if (pwmRightEl) pwmRightEl.textContent = this.telemetry.rightPWM + ' / 255';
    }
  }
}

// Global hook for initialization
window.initPIDSimulator = function() {
  const sim = new LineFollowerSim('pid-canvas');
  
  // Link controls
  const kpSlider = document.getElementById('sim-kp');
  const kiSlider = document.getElementById('sim-ki');
  const kdSlider = document.getElementById('sim-kd');
  const speedSlider = document.getElementById('sim-speed');
  
  const kpVal = document.getElementById('val-kp');
  const kiVal = document.getElementById('val-ki');
  const kdVal = document.getElementById('val-kd');
  const speedVal = document.getElementById('val-speed');
  
  const startBtn = document.getElementById('btn-sim-start');
  const stopBtn = document.getElementById('btn-sim-stop');
  const resetBtn = document.getElementById('btn-sim-reset');
  
  function updateParams() {
    if (kpVal && kpSlider instanceof HTMLInputElement) kpVal.textContent = kpSlider.value;
    if (kiVal && kiSlider instanceof HTMLInputElement) kiVal.textContent = kiSlider.value;
    if (kdVal && kdSlider instanceof HTMLInputElement) kdVal.textContent = kdSlider.value;
    if (speedVal && speedSlider instanceof HTMLInputElement) speedVal.textContent = speedSlider.value;
    
    if (kpSlider instanceof HTMLInputElement && kiSlider instanceof HTMLInputElement && 
        kdSlider instanceof HTMLInputElement && speedSlider instanceof HTMLInputElement) {
      sim.setParams(kpSlider.value, kiSlider.value, kdSlider.value, speedSlider.value);
    }
  }
  
  if (kpSlider instanceof HTMLInputElement) {
    kpSlider.addEventListener('input', updateParams);
    if (kiSlider instanceof HTMLInputElement) kiSlider.addEventListener('input', updateParams);
    if (kdSlider instanceof HTMLInputElement) kdSlider.addEventListener('input', updateParams);
    if (speedSlider instanceof HTMLInputElement) speedSlider.addEventListener('input', updateParams);
  }
  
  if (startBtn instanceof HTMLElement) {
    startBtn.addEventListener('click', () => sim.start());
    if (stopBtn instanceof HTMLElement) stopBtn.addEventListener('click', () => sim.stop());
    if (resetBtn instanceof HTMLElement) {
      resetBtn.addEventListener('click', () => {
        sim.stop();
        sim.resetRobot();
        sim.draw();
      });
    }
  }
  
  // Set initial params
  updateParams();
  
  // Draw initial state
  sim.draw();
  
  return sim;
};
