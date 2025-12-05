/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';

// --- 配置与状态 ---
const HEN_SRC = 'https://github.com/Hadsam666/1/blob/main/removed_bg_1764665516346.png?raw=true';
const ROOSTER_SRC = 'https://github.com/Hadsam666/1/blob/main/removed_bg_1764666269021.png?raw=true';
const CHICK_SRC = 'https://github.com/Hadsam666/1/blob/main/removed_bg_1764680064142.png?raw=true';
const FEED_SRC = 'https://github.com/Hadsam666/1/blob/main/removed_bg_1764743525503.png?raw=true';

const COLS = 4;
const ROWS = 4;

// 物理参数
const ANIMATION_SPEED = 4; 
const MAX_SPEED = 2.0;         
const MAX_FORCE = 0.03;        
const RUN_SPEED = 5.0;         
const PERCEPTION_RADIUS = 60;  
const SEPARATION_RADIUS = 50;  

// 范围与食物参数
const FOOD_RANGE = 250;        
const SCARE_RANGE = 150;       
const FOOD_MAX_AMOUNT = 300;   
const MAX_FEEDS = 10;          
const STUCK_THRESHOLD = 60;    
const PANIC_RADIUS = 70;       
const PANIC_CHANCE = 0.02;     

const STATES = {
    IDLE: 'IDLE',
    WALKING: 'WALKING',
    EATING: 'EATING',
    SCARED: 'SCARED'
};

// --- 向量辅助类 ---
class Vector {
    x: number;
    y: number;
    constructor(x: number, y: number) { this.x = x; this.y = y; }
    add(v: Vector) { this.x += v.x; this.y += v.y; return this; }
    sub(v: Vector) { this.x -= v.x; this.y -= v.y; return this; }
    mult(n: number) { this.x *= n; this.y *= n; return this; }
    div(n: number) { if(n!==0){this.x /= n; this.y /= n;} return this; }
    mag() { return Math.sqrt(this.x*this.x + this.y*this.y); }
    normalize() {
        let m = this.mag();
        if (m > 0) this.div(m);
        return this;
    }
    limit(max: number) {
        if (this.mag() > max) {
            this.normalize().mult(max);
        }
        return this;
    }
    copy() {
        return new Vector(this.x, this.y);
    }
    rotate(angle: number) {
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const nx = this.x * ca - this.y * sa;
        const ny = this.x * sa + this.y * ca;
        this.x = nx;
        this.y = ny;
        return this;
    }
    static dist(v1: Vector, v2: Vector) {
        return Math.sqrt((v1.x-v2.x)**2 + (v1.y-v2.y)**2);
    }
}

// Types
interface Chicken {
    name: string;
    img: HTMLImageElement;
    scale: number;
    pos: Vector;
    lastPos: Vector;
    vel: Vector;
    acc: Vector;
    spriteW: number;
    spriteH: number;
    target: Vector | null;
    targetType: string;
    targetFoodId: number | null;
    state: string;
    nextState: string;
    frameIndex: number;
    tickCount: number;
    facingRight: boolean;
    facingCooldown: number;
    currentMaxSpeed: number;
    stuckFrames: number;
    timer: number;
    aiTimer: number;
}

interface Feed {
    x: number;
    y: number;
    amount: number;
    id: number;
}

const App: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const statusRef = useRef<HTMLDivElement>(null);
    
    // Game State stored in refs to be accessible in the game loop closure
    const flockRef = useRef<Chicken[]>([]);
    const feedsRef = useRef<Feed[]>([]);
    const loadedCountRef = useRef(0);
    const clickEffectRef = useRef({ x: 0, y: 0, radius: 0, maxRadius: 0, alpha: 0, active: false, color: '' });
    const feedImgRef = useRef<HTMLImageElement | null>(null);
    const requestRef = useRef<number>(0);

    // --- Helper to update status text ---
    const updateStatus = (text: string) => {
        if (statusRef.current) {
            statusRef.current.innerText = text;
        }
    };

    // --- Load Chicken Function ---
    const loadChicken = (src: string, startX: number, startY: number, name: string, scale: number) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const spriteW = Math.floor(img.width / COLS);
            const spriteH = Math.floor(img.height / ROWS);
            createChickenObject(img, startX, startY, name, scale, spriteW, spriteH);
            
            loadedCountRef.current++;
            if(loadedCountRef.current <= 3) {
                updateStatus(`初始加载: ${loadedCountRef.current}/3 完成`);
            } else {
                updateStatus(`新增一只${name}`);
            }
        };
        img.onerror = () => {
            updateStatus(`⚠️ ${name} 图片加载失败`);
        };
    };

    const createChickenObject = (img: HTMLImageElement, x: number, y: number, name: string, scale: number, spriteW: number, spriteH: number) => {
        const chicken: Chicken = {
            name: name,
            img: img,
            scale: scale,
            pos: new Vector(x, y),
            lastPos: new Vector(x, y),
            vel: new Vector(Math.random() - 0.5, Math.random() - 0.5),
            acc: new Vector(0, 0),
            
            spriteW: spriteW,
            spriteH: spriteH,
            
            target: null,
            targetType: 'NONE', 
            targetFoodId: null,
            
            state: STATES.IDLE,
            nextState: STATES.IDLE,
            frameIndex: 0,
            tickCount: 0,
            facingRight: name !== '母鸡',
            facingCooldown: 0, 
            currentMaxSpeed: MAX_SPEED, 
            
            stuckFrames: 0,
            
            timer: 0,
            aiTimer: Math.random() * 200 + 50 
        };
        flockRef.current.push(chicken);
    };

    // --- Button Handlers ---
    const addHen = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        loadChicken(HEN_SRC, Math.random() * (canvas.width-100)+50, Math.random() * (canvas.height-100)+50, '母鸡', 0.25);
    };

    const addRooster = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        loadChicken(ROOSTER_SRC, Math.random() * (canvas.width-100)+50, Math.random() * (canvas.height-100)+50, '公鸡', 0.25);
    };

    const addChick = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        loadChicken(CHICK_SRC, Math.random() * (canvas.width-100)+50, Math.random() * (canvas.height-100)+50, '小鸡', 0.125);
    };

    // --- Main Game Effect ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize Feed Image
        const fImg = new Image();
        fImg.src = FEED_SRC;
        feedImgRef.current = fImg;

        // Resize
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Initial Flock
        loadChicken(HEN_SRC, canvas.width / 2 - 60, canvas.height / 2 - 30, '母鸡', 0.25);
        loadChicken(ROOSTER_SRC, canvas.width / 2 + 60, canvas.height / 2 - 30, '公鸡', 0.25);
        loadChicken(CHICK_SRC, canvas.width / 2, canvas.height / 2 + 50, '小鸡', 0.125);

        // --- Logic Functions ---

        const checkBlocked = (chicken: Chicken, dirVector: Vector, flock: Chicken[], lookAhead = 60) => {
            const radius = 35; 
            const forward = dirVector.copy().normalize();

            for (let other of flock) {
                if (other === chicken) continue;
                const d = Vector.dist(chicken.pos, other.pos);
                if (d > lookAhead) continue; 
                const toOther = new Vector(other.pos.x - chicken.pos.x, other.pos.y - chicken.pos.y);
                const dot = toOther.x * forward.x + toOther.y * forward.y;
                if (dot > 0 && dot < lookAhead) {
                    const perpDist = Math.sqrt(Math.max(0, d*d - dot*dot));
                    if (perpDist < radius) return true;
                }
            }
            return false;
        };

        const findBreakoutDir = (chicken: Chicken, flock: Chicken[]) => {
            const step = Math.PI / 6; 
            const shortLookAhead = 30; 

            for (let i = 0; i < 12; i++) { 
                const angle = i * step;
                const dir = new Vector(Math.cos(angle), Math.sin(angle));
                if (!checkBlocked(chicken, dir, flock, shortLookAhead)) {
                    return dir;
                }
            }
            return null;
        };

        const findDetour = (chicken: Chicken, flock: Chicken[]) => {
            const angles = [Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2];
            for (let angle of angles) {
                let testVel = chicken.vel.copy().rotate(angle);
                if (!checkBlocked(chicken, testVel, flock, 60)) {
                    return testVel.normalize();
                }
            }
            return null;
        };

        const seek = (chicken: Chicken, target: Vector) => {
            let desired = new Vector(target.x - chicken.pos.x, target.y - chicken.pos.y);
            let d = desired.mag();
            desired.normalize();
            
            let slowDownRadius = (chicken.targetType === 'FOOD') ? 20 : 50;
            
            if (d < slowDownRadius) {
                let m = (d / slowDownRadius) * chicken.currentMaxSpeed;
                desired.mult(m);
            } else {
                desired.mult(chicken.currentMaxSpeed);
            }
            let steer = desired.sub(chicken.vel);
            steer.limit(MAX_FORCE);
            return steer;
        };

        const separate = (chicken: Chicken, flock: Chicken[]) => {
            let steer = new Vector(0, 0);
            let count = 0;
            let effectiveRadius = (chicken.targetType === 'FOOD' || chicken.state === STATES.EATING) 
                ? SEPARATION_RADIUS * 0.5 
                : SEPARATION_RADIUS;

            for (let other of flock) {
                let d = Vector.dist(chicken.pos, other.pos);
                if ((d > 0) && (d < effectiveRadius)) {
                    let diff = new Vector(chicken.pos.x - other.pos.x, chicken.pos.y - other.pos.y);
                    diff.normalize();
                    diff.div(d);
                    steer.add(diff);
                    count++;
                }
            }
            if (count > 0) {
                steer.div(count);
            }
            if (steer.mag() > 0) {
                steer.normalize();
                steer.mult(chicken.currentMaxSpeed);
                steer.sub(chicken.vel);
                steer.limit(MAX_FORCE);
            }
            return steer;
        };

        const align = (chicken: Chicken, flock: Chicken[]) => {
            let sum = new Vector(0, 0);
            let count = 0;
            for (let other of flock) {
                let d = Vector.dist(chicken.pos, other.pos);
                if ((d > 0) && (d < PERCEPTION_RADIUS)) {
                    sum.add(other.vel);
                    count++;
                }
            }
            if (count > 0) {
                sum.div(count);
                sum.normalize();
                sum.mult(chicken.currentMaxSpeed);
                let steer = sum.sub(chicken.vel);
                steer.limit(MAX_FORCE);
                return steer;
            }
            return new Vector(0, 0);
        };

        const cohesionFunc = (chicken: Chicken, flock: Chicken[]) => {
            let sum = new Vector(0, 0);
            let count = 0;
            for (let other of flock) {
                let d = Vector.dist(chicken.pos, other.pos);
                if ((d > 0) && (d < PERCEPTION_RADIUS)) {
                    sum.add(other.pos);
                    count++;
                }
            }
            if (count > 0) {
                sum.div(count);
                return seek(chicken, sum);
            }
            return new Vector(0, 0);
        };

        const avoidWalls = (chicken: Chicken) => {
            let steer = new Vector(0, 0);
            const buffer = 50;
            if (chicken.pos.x < buffer) steer.x = chicken.currentMaxSpeed;
            if (chicken.pos.x > canvas.width - buffer) steer.x = -chicken.currentMaxSpeed;
            if (chicken.pos.y < buffer) steer.y = chicken.currentMaxSpeed;
            if (chicken.pos.y > canvas.height - buffer) steer.y = -chicken.currentMaxSpeed;
            
            if (steer.mag() > 0) {
                steer.normalize();
                steer.mult(chicken.currentMaxSpeed);
                steer.sub(chicken.vel);
                steer.limit(MAX_FORCE * 2);
            }
            return steer;
        };

        const applyBehaviors = (chicken: Chicken, flock: Chicken[]) => {
            let separation = separate(chicken, flock);
            let alignment = align(chicken, flock);
            let cohesion = cohesionFunc(chicken, flock);
            let seekForce = new Vector(0,0);
            let boundaryForce = avoidWalls(chicken);

            if (chicken.state === STATES.IDLE) {
                separation.mult(0.1); 
                chicken.acc.add(separation);
                chicken.vel.mult(0.85); 
                boundaryForce.mult(1.0);
                chicken.acc.add(boundaryForce);
                return; 
            }

            if (chicken.state === STATES.SCARED) {
                separation.mult(3.0); 
                alignment.mult(5.0);  
                cohesion.mult(1.5);   
                
                let wander = new Vector(Math.random()-0.5, Math.random()-0.5).mult(1.5);
                chicken.acc.add(wander);
                
                chicken.currentMaxSpeed = RUN_SPEED;
                boundaryForce.mult(5.0); 

                chicken.acc.add(separation);
                chicken.acc.add(alignment);
                chicken.acc.add(cohesion);
                chicken.acc.add(boundaryForce);
                return; 
            }

            let neighborCount = 0;
            for (let other of flock) {
                if (other !== chicken) {
                    let d = Vector.dist(chicken.pos, other.pos);
                    if (d < SEPARATION_RADIUS) neighborCount++;
                }
            }
            const isCrowded = neighborCount > 0;
            const isInteractingWithFood = (chicken.targetType === 'FOOD') || (chicken.state === STATES.EATING);

            if (isInteractingWithFood) {
                separation.mult(0.8); 
                alignment.mult(0);    
                cohesion.mult(0);
            } else if (isCrowded) {
                separation.mult(4.0); 
                alignment.mult(0.1);  
                cohesion.mult(0);     
            } else {
                separation.mult(2.5);
                alignment.mult(1.0);
                cohesion.mult(0.2); 
            }

            boundaryForce.mult(3.0); 

            if (chicken.state === STATES.WALKING && chicken.target) {
                seekForce = seek(chicken, chicken.target);
                if (chicken.targetType === 'FOOD') {
                    seekForce.mult(2.0);
                } else {
                    seekForce.mult(1.5); 
                }
            }

            chicken.acc.add(separation);
            chicken.acc.add(alignment);
            chicken.acc.add(cohesion);
            chicken.acc.add(seekForce);
            chicken.acc.add(boundaryForce);
        };

        const update = () => {
            const flock = flockRef.current;
            const feeds = feedsRef.current;
            const clickEffect = clickEffectRef.current;

            // Filter feeds
            feedsRef.current = feeds.filter(feed => {
                let eatingCount = 0;
                flock.forEach(c => {
                    if (c.state === STATES.EATING && c.targetType === 'FOOD' && c.targetFoodId === feed.id) {
                        eatingCount++;
                    }
                });
                if (eatingCount > 0) feed.amount -= eatingCount * 1;
                if (feed.amount <= 0) {
                    flock.forEach(chicken => {
                        if (chicken.targetFoodId === feed.id) {
                            if (chicken.state === STATES.EATING) {
                                chicken.state = STATES.IDLE;
                                chicken.targetType = 'NONE';
                                chicken.targetFoodId = null;
                                chicken.aiTimer = 60; 
                            }
                            else if (chicken.state === STATES.WALKING) {
                                chicken.state = STATES.IDLE;
                                chicken.target = null;
                                chicken.targetType = 'NONE';
                                chicken.targetFoodId = null;
                                chicken.vel.mult(0);
                                chicken.aiTimer = 30; 
                            }
                        }
                    });
                    return false; 
                }
                return true; 
            });

            flock.forEach(chicken => {
                chicken.tickCount++;
                let currentAnimSpeed = ANIMATION_SPEED;
                if (chicken.state === STATES.SCARED) currentAnimSpeed = ANIMATION_SPEED / 2;

                if (chicken.tickCount > currentAnimSpeed) {
                    chicken.tickCount = 0;
                    chicken.frameIndex = (chicken.frameIndex + 1) % COLS;
                }

                if (chicken.facingCooldown > 0) chicken.facingCooldown--;

                if (chicken.state === STATES.SCARED) {
                    flock.forEach(other => {
                        if (other !== chicken && other.state !== STATES.SCARED) {
                            let d = Vector.dist(chicken.pos, other.pos);
                            if (d < PANIC_RADIUS && Math.random() < PANIC_CHANCE) {
                                other.state = STATES.SCARED;
                                other.targetType = 'NONE';
                                other.targetFoodId = null;
                                other.target = null;
                                other.timer = 80 + Math.random() * 40; 
                                
                                let fleeDir = new Vector(other.pos.x - chicken.pos.x, other.pos.y - chicken.pos.y);
                                fleeDir.normalize().mult(RUN_SPEED);
                                other.vel = fleeDir;
                                other.aiTimer = 60;
                            }
                        }
                    });
                }

                applyBehaviors(chicken, flock);

                switch (chicken.state) {
                    case STATES.IDLE:
                        chicken.stuckFrames = 0;
                        chicken.aiTimer--;
                        if (chicken.aiTimer <= 0) {
                            let foundFood = null;
                            let minDist = FOOD_RANGE;

                            if (feedsRef.current.length > 0) {
                                for(let f of feedsRef.current) {
                                    let d = Vector.dist(chicken.pos, new Vector(f.x, f.y));
                                    if (d < minDist) {
                                        minDist = d;
                                        foundFood = f;
                                    }
                                }
                            }

                            if (foundFood) {
                                const side = Math.random() < 0.5 ? -1 : 1; 
                                const offsetX = side * (25 + Math.random() * 15); 
                                const offsetY = -(25 + Math.random() * 15);

                                chicken.target = new Vector(
                                    foundFood.x + offsetX, 
                                    foundFood.y + offsetY
                                );
                                chicken.targetType = 'FOOD';
                                chicken.targetFoodId = foundFood.id;
                                chicken.state = STATES.WALKING;
                                chicken.nextState = STATES.EATING;
                            } else {
                                const action = Math.random();
                                if (action < 0.7) { 
                                    chicken.state = STATES.WALKING;
                                    chicken.nextState = STATES.IDLE;
                                    chicken.targetType = 'WANDER';
                                    chicken.targetFoodId = null;
                                    let tx = Math.min(Math.max(chicken.pos.x + (Math.random()*400-200), 50), canvas.width-50);
                                    let ty = Math.min(Math.max(chicken.pos.y + (Math.random()*400-200), 50), canvas.height-50);
                                    chicken.target = new Vector(tx, ty);
                                } else {
                                    chicken.state = STATES.EATING;
                                    chicken.targetType = 'NONE';
                                    chicken.targetFoodId = null;
                                    chicken.timer = 60 + Math.random() * 60;
                                }
                            }
                            chicken.aiTimer = 100 + Math.random() * 200;
                        }
                        break;

                    case STATES.WALKING:
                        chicken.vel.add(chicken.acc);
                        chicken.vel.limit(chicken.currentMaxSpeed); 
                        chicken.pos.add(chicken.vel);
                        chicken.acc.mult(0);

                        let distMoved = Vector.dist(chicken.pos, chicken.lastPos);
                        chicken.lastPos = chicken.pos.copy();

                        if (distMoved < 0.5) {
                            chicken.stuckFrames++;
                        } else {
                            chicken.stuckFrames = 0;
                        }

                        let isBreakingOut = false;
                        if (chicken.stuckFrames > STUCK_THRESHOLD) {
                            const breakoutDir = findBreakoutDir(chicken, flock);
                            if (breakoutDir) {
                                chicken.vel = breakoutDir.mult(chicken.currentMaxSpeed);
                                chicken.stuckFrames = 0; 
                                isBreakingOut = true; 
                            }
                        }

                        if (!isBreakingOut) {
                            const shouldAvoidPath = chicken.targetType !== 'FOOD'; 
                            
                            if (shouldAvoidPath && chicken.vel.mag() > 0.5 && checkBlocked(chicken, chicken.vel, flock, 60)) {
                                const detourDir = findDetour(chicken, flock);
                                if (detourDir) {
                                    chicken.vel = detourDir.mult(chicken.currentMaxSpeed);
                                } else {
                                    chicken.vel.mult(0);
                                    chicken.target = null;
                                    chicken.targetType = 'NONE';
                                    chicken.targetFoodId = null;
                                    chicken.state = STATES.IDLE;
                                    chicken.aiTimer = 20; 
                                    break; 
                                }
                            }
                        }

                        if (Math.abs(chicken.vel.x) > 0.2 && chicken.facingCooldown <= 0) {
                            const newFacing = chicken.vel.x > 0;
                            if (chicken.facingRight !== newFacing) {
                                chicken.facingRight = newFacing;
                                chicken.facingCooldown = 20; 
                            }
                        }

                        if (chicken.target) {
                            let d = Vector.dist(chicken.pos, chicken.target);
                            if (d < 10) {
                                chicken.state = chicken.nextState;
                                if (chicken.state === STATES.EATING) {
                                    if (chicken.targetType === 'FOOD') {
                                        chicken.timer = 999999; 
                                    } else {
                                        chicken.timer = 60 + Math.random() * 60;
                                    }
                                } else if (chicken.state === STATES.IDLE) {
                                    chicken.aiTimer = 60 + Math.random() * 60;
                                }
                            }
                        }
                        break;

                    case STATES.EATING:
                        chicken.stuckFrames = 0;
                        chicken.vel.mult(0.5);
                        
                        if (chicken.targetType === 'FOOD' && chicken.targetFoodId) {
                            const currentFeed = feedsRef.current.find(f => f.id === chicken.targetFoodId);
                            if (currentFeed) {
                                chicken.facingRight = chicken.pos.x < currentFeed.x;
                            }
                        }

                        if (chicken.timer < 900000) {
                            if (chicken.timer > 0) chicken.timer--;
                            else chicken.state = STATES.IDLE;
                        }
                        break;

                    case STATES.SCARED:
                        chicken.stuckFrames = 0;
                        chicken.vel.add(chicken.acc);
                        chicken.vel.limit(RUN_SPEED);
                        chicken.pos.add(chicken.vel);
                        chicken.acc.mult(0);

                        if (chicken.vel.x > 0) chicken.facingRight = true;
                        if (chicken.vel.x < 0) chicken.facingRight = false;

                        if (chicken.timer > 0) {
                            chicken.timer--;
                        } else {
                            chicken.state = STATES.IDLE;
                            chicken.targetType = 'NONE';
                            chicken.targetFoodId = null;
                            chicken.aiTimer = 60;
                        }
                        break;
                }
            });

            if (clickEffect.active) {
                clickEffect.radius += 10;
                clickEffect.alpha -= 0.05;
                if (clickEffect.alpha <= 0) {
                    clickEffect.active = false;
                }
            }
        };

        const draw = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const clickEffect = clickEffectRef.current;
            if (clickEffect.active) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(clickEffect.x, clickEffect.y, clickEffect.radius, 0, Math.PI * 2);
                ctx.fillStyle = clickEffect.color.replace('0.5', String(Math.max(0, clickEffect.alpha)));
                ctx.fill();
                ctx.strokeStyle = clickEffect.color.replace('0.5', String(Math.max(0, clickEffect.alpha)));
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

            if (loadedCountRef.current < 3) {
                ctx.fillStyle = "white";
                ctx.textAlign = "center";
                ctx.font = "20px sans-serif";
                ctx.fillText(`资源加载中 (${loadedCountRef.current}/3)...`, canvas.width/2, canvas.height/2);
            }

            feedsRef.current.forEach(f => {
                const img = feedImgRef.current;
                if (img && img.complete && img.naturalWidth > 0) {
                    const cols = 2;
                    const rows = 2;
                    const totalFrames = 4;
                    const percent = Math.max(0, f.amount / FOOD_MAX_AMOUNT);
                    let frame = Math.floor((1 - percent) * totalFrames);
                    if (frame > 3) frame = 3;
                    if (frame < 0) frame = 0;

                    const spriteW = img.width / cols;
                    const spriteH = img.height / rows;
                    const col = frame % cols;
                    const row = Math.floor(frame / cols);
                    const sx = col * spriteW;
                    const sy = row * spriteH;
                    const size = 48; 

                    ctx.drawImage(img, sx, sy, spriteW, spriteH, f.x - size / 2, f.y - size / 2, size, size);
                } else {
                    ctx.fillStyle = "#D2B48C";
                    ctx.beginPath();
                    const r = 2 + (f.amount / FOOD_MAX_AMOUNT) * 6;
                    ctx.arc(f.x, f.y, r, 0, Math.PI*2);
                    ctx.fill();
                    
                    ctx.strokeStyle = "rgba(0,0,0,0.2)";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(f.x, f.y, 8, 0, (f.amount / FOOD_MAX_AMOUNT) * Math.PI * 2);
                    ctx.stroke();
                }
            });

            const sortedFlock = [...flockRef.current].sort((a, b) => a.pos.y - b.pos.y);

            sortedFlock.forEach(chicken => {
                let row = 3; 
                if (chicken.state === STATES.WALKING) row = 0;
                else if (chicken.state === STATES.EATING) row = 1;
                else if (chicken.state === STATES.SCARED) row = 2;

                const sx = chicken.frameIndex * chicken.spriteW;
                const sy = row * chicken.spriteH;
                const dw = chicken.spriteW * chicken.scale;
                const dh = chicken.spriteH * chicken.scale;

                ctx.save();
                ctx.translate(chicken.pos.x, chicken.pos.y);
                if (!chicken.facingRight) ctx.scale(-1, 1);

                ctx.drawImage(chicken.img, sx, sy, chicken.spriteW, chicken.spriteH, -dw/2, -dh/2, dw, dh);
                ctx.restore();
            });

            if(loadedCountRef.current >= 3) {
                // Update status text only occasionally if needed, or rely on requestAnimationFrame loop.
                // Doing it every frame in JS is fine, in React DOM diffing it's heavy, but we are using refs to direct DOM update.
                const counts = { '母鸡': 0, '公鸡': 0, '小鸡': 0 };
                flockRef.current.forEach(c => {
                    const name = c.name as keyof typeof counts;
                    if (counts[name] !== undefined) counts[name]++;
                });
                updateStatus(`数量: 母鸡${counts['母鸡']} / 公鸡${counts['公鸡']} / 小鸡${counts['小鸡']}`);
            }
        };

        const loop = () => {
            update();
            draw();
            requestRef.current = requestAnimationFrame(loop);
        };

        // --- Event Listeners ---
        const handleMouseDown = (e: MouseEvent) => {
            if (flockRef.current.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const clickPos = new Vector(mouseX, mouseY);

            if (e.button === 0) { 
                clickEffectRef.current = {
                    x: mouseX,
                    y: mouseY,
                    radius: 0,
                    active: true,
                    alpha: 1.0,
                    maxRadius: SCARE_RANGE,
                    color: "rgba(255, 255, 255, 0.5)"
                };

                flockRef.current.forEach(chicken => {
                    let d = Vector.dist(chicken.pos, clickPos);
                    if (d < SCARE_RANGE) {
                        chicken.state = STATES.SCARED;
                        chicken.targetType = 'NONE';
                        chicken.targetFoodId = null;
                        chicken.target = null;
                        chicken.timer = 120 + Math.random() * 60;
                        
                        let fleeDir = new Vector(chicken.pos.x - mouseX, chicken.pos.y - mouseY);
                        fleeDir.normalize().mult(RUN_SPEED);
                        chicken.vel = fleeDir;
                        chicken.aiTimer = 60; 
                    }
                });
            }
        };

        const handleDblClick = (e: MouseEvent) => {
            if (flockRef.current.length === 0) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const clickPos = new Vector(mouseX, mouseY);

            clickEffectRef.current = {
                x: mouseX,
                y: mouseY,
                radius: 0,
                active: true,
                alpha: 1.0,
                maxRadius: FOOD_RANGE,
                color: "rgba(210, 180, 140, 0.5)"
            };

            if (feedsRef.current.length >= MAX_FEEDS) {
                feedsRef.current.shift();
            }

            const newFeed = { 
                x: mouseX, 
                y: mouseY, 
                amount: FOOD_MAX_AMOUNT,
                id: Date.now() + Math.random() 
            };
            feedsRef.current.push(newFeed);

            flockRef.current.forEach(chicken => {
                let d = Vector.dist(chicken.pos, clickPos);
                if (d < FOOD_RANGE) {
                    const side = Math.random() < 0.5 ? -1 : 1;
                    const offsetX = side * (25 + Math.random() * 15);
                    const offsetY = -(25 + Math.random() * 15);

                    chicken.target = new Vector(mouseX + offsetX, mouseY + offsetY);
                    chicken.targetType = 'FOOD'; 
                    chicken.targetFoodId = newFeed.id;
                    chicken.state = STATES.WALKING;
                    chicken.nextState = STATES.EATING;
                    chicken.timer = 0; 
                }
            });
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('dblclick', handleDblClick);
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        requestRef.current = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(requestRef.current);
            window.removeEventListener('resize', resizeCanvas);
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('dblclick', handleDblClick);
        };
    }, []);

    return (
        <div id="gameContainer">
            <div id="ui-layer">
                <div className="key-instruction"><span className="key">左键</span> 惊吓 (Run)</div>
                <div className="key-instruction"><span className="key">双击</span> 多点喂食 (Feed)</div>
                
                <div className="btn-group">
                    <button className="btn" onClick={addHen}>+ 母鸡</button>
                    <button className="btn" onClick={addRooster}>+ 公鸡</button>
                    <button className="btn" onClick={addChick}>+ 小鸡</button>
                </div>

                <div id="status" ref={statusRef}>状态: 正在初始化...</div>
            </div>
            <canvas ref={canvasRef}></canvas>
        </div>
    );
};

export default App;
