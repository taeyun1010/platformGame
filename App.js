let levelGlobal = 0;

class Vec {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    plus(other) {
        return new Vec(this.x + other.x, this.y + other.y);
    }

    times(factor) {
        return new Vec(this.x * factor, this.y * factor);
    }
}

class Lava {
    constructor(pos, speed, reset) {
        this.pos = pos;
        this.speed = speed;
        this.reset = reset;
    }

    get type() {
        return "lava";
    }

    static create(pos, ch) {
        if (ch == "=") {
            return new Lava(pos, new Vec(2, 0));
        }
        else if (ch == "|") {
            return new Lava(pos, new Vec(0, 2));
        }
        else if (ch == "v") {
            return new Lava(pos, new Vec(0, 3), pos);
        }
    }
}

Lava.prototype.size = new Vec(1, 1);

Lava.prototype.update = function(time, state) {
    let newPos = this.pos.plus(this.speed.times(time));
    if (!state.level.touches(newPos, this.size, "wall")) {
        return new Lava(newPos, this.speed, this.reset);
    }
    else if (this.reset) {
        return new Lava(this.reset, this.speed, this.reset);
    }
    else {
        return new Lava(this.pos, this.speed.times(-1));
    }
}; 

Lava.prototype.collide = function (state) {
    return new State(state.level, state.actors, "lost");
};

class Coin {
    constructor(pos, basePos, wobble) {
        this.pos = pos;
        this.basePos = basePos;
        this.wobble = wobble;
    }

    get type() {
        return "coin";
    }

    static create(pos) {
        let basePos = pos.plus(new Vec(0.2, 0.1));
        return new Coin(pos, basePos, Math.random() * Math.PI * 2);
    }
}

Coin.prototype.size = new Vec(0.6, 0.6);

const wobbleSpeed = 8;
const wobbleDist = 0.07;

Coin.prototype.update = function (time) {
    let wobble = this.wobble + time * wobbleSpeed;
    let wobblePos = Math.sin(wobble) * wobbleDist;
    return new Coin(this.basePos.plus(new Vec(0, wobblePos)),
    this.basePos, wobble);
}

Coin.prototype.collide = function (state) {
    let filtered = state.actors.filter(a => a != this);
    let status = state.status;
    if (!filtered.some(a => a.type == "coin")) 
        status = "won";
    return new State(state.level, filtered, status);
}

class Player {
    constructor(pos, speed) {
        this.pos = pos;
        this.speed = speed;
    }

    get type() {
        return "player";
    }

    static create(pos) {
        return new Player(pos.plus(new Vec(0, -0.5)), new Vec(0, 0));
    }
}

Player.prototype.size = new Vec(0.8, 1.5);

const playerXSpeed = 7;
const gravity = 30;
const jumpSpeed = 17;

Player.prototype.update = function (time, state, keys) {
    let xSpeed = 0;
    if (keys.ArrowLeft)
        xSpeed -= playerXSpeed;
    if (keys.ArrowRight)
        xSpeed += playerXSpeed;
    let pos = this.pos;
    let movedX = pos.plus(new Vec(xSpeed * time, 0));
    if (!state.level.touches(movedX, this.size, "wall")) {
        pos = movedX;
    }

    let ySpeed = this.speed.y + time * gravity;
    let movedY = pos.plus(new Vec(0, ySpeed * time));
    if (!state.level.touches(movedY, this.size, "wall")) {
        pos = movedY;
    }
    else if (keys.ArrowUp && ySpeed > 0) {
        ySpeed = -jumpSpeed;
    }
    else {
        ySpeed = 0;
    }
    return new Player(pos, new Vec(xSpeed, ySpeed));
}

class Monster {
    constructor(pos, speed) {
        this.pos = pos;
        this.speed = speed;
    }

    get type() {
        return "monster";
    }

    static create(pos) {
        return new Monster(pos.plus(new Vec(0, -0.5)), new Vec(6, 0));
    }
}

Monster.prototype.size = new Vec(0.8, 1.5);

Monster.prototype.update = function (time, state) {
    let xSpeed = this.speed.x;
    let pos = this.pos;
    let movedX = pos.plus(new Vec(xSpeed * time, 0));
    if (!state.level.touches(movedX, this.size, "wall")) {
        movedX = pos.plus(new Vec(xSpeed * time, 0));
        pos = movedX;
    }
    else {
        xSpeed = -xSpeed;            
        movedX = pos.plus(new Vec(xSpeed * time, 0));
        pos = movedX;
    }

    return new Monster(pos, new Vec(xSpeed, this.speed.y));
};

Monster.prototype.collide = function (state) {
    const player = state.player;
    const playerY = player.pos.y;
    const monsterY = this.pos.y;

    if (playerY <= monsterY - 1) {
        const filtered = state.actors.filter(a => a != this);
        return new State(state.level, filtered, state.status);
    }
    else { 
        return new State(state.level, state.actors, "lost");
    }
};

class SmartMonster extends Monster {
    static create(pos) {
        return new SmartMonster(pos.plus(new Vec(0, -0.5)), new Vec(4, 0));
    }
}

SmartMonster.prototype.update = function (time, state) {
    let xSpeed = this.speed.x;
    let pos = this.pos;
    let movedX = pos.plus(new Vec(xSpeed * time, 0));
    if (!state.level.touches(movedX, this.size, "wall")) {
        if (state.player.pos.x < this.pos.x) {
            xSpeed = -Math.abs(xSpeed);            
            movedX = pos.plus(new Vec(xSpeed * time, 0));
        }
        else {
            xSpeed = Math.abs(xSpeed);
        }
        pos = movedX;
    }
    else {
        xSpeed = -xSpeed;            
        movedX = pos.plus(new Vec(xSpeed * time, 0));
        pos = movedX;
    }

    return new SmartMonster(pos, new Vec(xSpeed, this.speed.y));
};

const levelChars = {
    ".": "empty", "#": "wall", "+": "lava",
    "@": Player, "o": Coin,
    "=": Lava, "|": Lava, "v": Lava,
    "x": Monster, "X": SmartMonster
};

class Level {
    constructor(plan) {
        let rows = plan.trim().split("\n").map(l => [...l]);
        this.height = rows.length;
        this.width = rows[0].length;
        this.startActors = [];
        this.rows = rows.map((row, y) => {
            return row.map((ch, x) => {
                let type = levelChars[ch];
                if (typeof type == "string") return type;
                this.startActors.push(
                    type.create(new Vec(x, y), ch)
                );
                return "empty";
            });
        });
    }
}

Level.prototype.touches = function (pos, size, type) {
    const xStart = Math.floor(pos.x);
    const xEnd = Math.ceil(pos.x + size.x);
    const yStart = Math.floor(pos.y);
    const yEnd = Math.ceil(pos.y + size.y);

    for (let y = yStart; y < yEnd; ++y) {
        for (let x = xStart; x < xEnd; ++x) {
            const isOutside = x < 0 || x >= this.width ||
            y < 0 || y >= this.height;
            const here = isOutside? "wall" : this.rows[y][x];

            if (here == type) return true;
        }
    }
    return false;
};

class State {
    constructor(level, actors, status) {
        this.level = level;
        this.actors = actors;
        this.status = status;
    }

    static start(level) {
        return new State(level, level.startActors, "playing");
    }

    get player() {
        return this.actors.find(a => a.type == "player");
    }
}

State.prototype.steppedOn = function(playerY) {
    return this.actors.some(actor => {
        if (actor.type !== "monster")
            return false;
        return playerY <= actor.pos.y - 1;
    });
}

State.prototype.update = function (time, keys) {
    let actors = this.actors.map(actor => actor.update(time, this, keys));
    let newState = new State(this.level, actors, this.status);

    if (newState.status != "playing") { 
        return newState;
    }
    
    let player = newState.player;
    if (this.level.touches(player.pos, player.size, "lava")) {
        return new State(this.level, actors, "lost");
    }

    if (this.level.touches(player.pos, player.size, "monster")) {
        const playerY = player.pos.y;
        if (this.steppedOn(playerY)) {
            const filtered = state.actors.filter(a => a != this);
            return new State(state.level, filtered, state.status);
        }
        return new State(this.level, actors, "lost");
    }

    for (let actor of actors) {
        if (actor != player && overlap(actor, player)) {
            newState = actor.collide(newState);
        }
    }
    return newState;
};

function overlap(actor1, actor2) {
    return actor1.pos.x + actor1.size.x > actor2.pos.x &&
    actor1.pos.x < actor2.pos.x + actor2.size.x &&
    actor1.pos.y + actor1.size.y > actor2.pos.y &&
    actor1.pos.y < actor2.pos.y + actor2.size.y;
}

function elt(name, attrs, ...children) {
    let dom = document.createElement(name);
    for (let attr of Object.keys(attrs)) {
        dom.setAttribute(attr, attrs[attr]);
    }
    for (let child of children) {
        dom.appendChild(child);
    }
    return dom;
}

class DOMDisplay {
    constructor(parent, level) {
        this.dom = elt("div", { class: "game"}, drawGrid(level));
        this.actorLayer = null;
        parent.appendChild(this.dom);
    }

    clear() {
        this.dom.remove();
    }
}

const scale = 20;

function drawGrid(level) {
    return elt("table", {
        class: "background",
        style: `width: ${level.width * scale}px`
    }, ...level.rows.map(row => 
        elt("tr", { style: `height: ${scale}px`},
        ...row.map(type => elt("td", { class: type })))
        ));
}

function drawActors(actors) {
    return elt("div", {}, ...actors.map(actor => {
        let rect = elt("div", { class: `actor ${actor.type}`});
        rect.style.width = `${actor.size.x * scale}px`;
        rect.style.height = `${actor.size.y * scale}px`;
        rect.style.left = `${actor.pos.x * scale}px`;
        rect.style.top = `${actor.pos.y * scale}px`;
        return rect;
    }));
}

DOMDisplay.prototype.syncState = function (state) {
    if (this.actorLayer) this.actorLayer.remove();
    this.actorLayer = drawActors(state.actors);
    this.dom.appendChild(this.actorLayer);
    this.dom.className = `game ${state.status}`;
    this.scrollPlayerIntoView(state);
};

DOMDisplay.prototype.scrollPlayerIntoView = function(state) {
    let width = this.dom.clientWidth;
    let height = this.dom.clientHeight;
    let margin = width / 3;

    //viewport
    let left = this.dom.scrollLeft, right = left + width;
    let top = this.dom.scrollTop, bottom = top + height;

    let player = state.player;
    let center = player.pos.plus(player.size.times(0.5)).times(scale);

    if (center.x < left + margin) {
        this.dom.scrollLeft = center.x - margin;
    }
    else if (center.x > right - margin) {
        this.dom.scrollLeft = center.x + margin - width;
    }
    if (center.y < top + margin) {
        this.dom.scrollTop = center.y - margin;
    }
    else if (center.y > bottom - margin) {
        this.dom.scrollTop = center.y + margin - height;
    }
};

function trackKeys(keys, add) {
    if (add) {
        let down = Object.create(null);
        function track(event) {
            if (keys.includes(event.key)) {
                down[event.key] = event.type == "keydown";
                event.preventDefault()        
            }
        }
        window.addEventListener("keydown", track);
        window.addEventListener("keyup", track);
        return down;
    }
    else {
        window.removeEventListener("keydown", track);
        window.removeEventListener("keyup", track);
    }
}

// const arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"], true);

function runAnimation(frameFunc) {
    let lastTime = null;
    function frame(time) {
        if (lastTime != null) {
            let timeStep = Math.min(time - lastTime, 100) / 1000;
            if (frameFunc(timeStep) === false)
                return;
        }
        lastTime = time;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function runLevel(level, Display, replayMusic) {
    let display = new Display(document.body, level);
    let state = State.start(level);
    let ending = 1;
    let running = "yes";
    const arrowKeys = trackKeys(["ArrowLeft", "ArrowRight", "ArrowUp"], true);
    const backgroundDiv = document.querySelector(".background");
    const musicDiv = document.querySelector("audio");

    switch (levelGlobal) {
        case 0: {
            backgroundDiv.style.backgroundImage = "url('./background/angelIsland.png')";
            if (replayMusic)
                musicDiv.setAttribute("src", "./music/cirno.mp3");
            break;
        }
        case 1: {
            backgroundDiv.style.backgroundImage = "url('./background/skyBattery.png')";
            if (replayMusic)
                musicDiv.setAttribute("src", "./music/chineseTea.mp3");
            break;
        }
        case 2: {
            backgroundDiv.style.backgroundImage = "url('./background/skyBattery2.png')";
            if (replayMusic)
                musicDiv.setAttribute("src", "./music/cirno2.mp3");
            break;
        }
        case 3: {
            backgroundDiv.style.backgroundImage = "url('./background/lavaReef.png')";
            if (replayMusic)
                musicDiv.setAttribute("src", "./music/flandre.mp3");
            break;
        }
        case 4: {
            backgroundDiv.style.backgroundImage = "url('./background/doomsDay.png')";
            if (replayMusic)
                musicDiv.setAttribute("src", "./music/remilia.mp3");
            break;
        }
    }

    return new Promise(resolve => {
        function escHandler(event) {
            if (event.key !== "Escape")
                return;
            event.preventDefault();
            if (running === "yes") {
                running = "no";
            }
            else {
                running = "yes";
                runAnimation(frame);
            }
        }
        window.addEventListener("keyup", escHandler);

        let frame = time => {
            const input = document.querySelector(".stage-number"); 
            const inputHandler = () => {
                display.clear();
                trackKeys([], false);
                input.removeEventListener('change', inputHandler);
                window.removeEventListener("keyup", escHandler);
                resolve("skip");
                return false;
            };
            input.addEventListener('change', inputHandler);

            if (running === "no") {
                return false;
            }
            state = state.update(time, arrowKeys);
            display.syncState(state);
            if (state.status == "playing") {
                return true;
            }
            else if (ending > 0) {
                ending -= time;
                return true;
            }
            else {
                display.clear();
                trackKeys([], false);
                resolve(state.status);
                input.removeEventListener('change', inputHandler);
                window.removeEventListener("keyup", escHandler);
                return false;
            }
        };

        runAnimation(frame);
    });
}

async function runGame(plans, Display) {
    let replayMusic;
    let wasGameOver = false;
    for (let level = 0; level < plans.length;) {
        replayMusic = (replayMusic === undefined) ? true : replayMusic;
        // const music = document.querySelector("#youtube-audio");
        const stageNumber = document.querySelector(".stage-number").value;
        if (stageNumber) {
            level = stageNumber - 1;
        }
        if (wasGameOver) {
            level = 0;
            wasGameOver = false;
        }
        levelGlobal = level;
        let status = await runLevel(new Level(plans[level]), Display, replayMusic);

        if (status == "won") {
            level++;
            levelGlobal = level;
            replayMusic = true;
        }
        else if (status === "lost") {
            if (remainingLives-- === 0) {
                alert('Game Over');
                remainingLives = 3;
                level = 0;
                wasGameOver = true;
                replayMusic = true;
            }
            else {
                replayMusic = false;
            }
            document.getElementById('lives').value = remainingLives;
        }
        else if (status === "skip") {
            replayMusic = true;
            continue;
        }
    }
    alert("You've Won!");
}

const GAME_LEVELS = [`                                                    
................................................................................
................................................................................
................................................................................
................................................................................
................................................................................
................................................................................
..................................................................###...........
...................................................##......##....##+##..........
....................................o.o......##..................#+++#..........
.................................................................##+##..........
...................................#####..........................#v#...........
............................................................................##..
..##......................................o.o................................#..
..#.....................o....................................................#..
..#......................................#####.............................o.#..
..#..........####.......o....................................................#..
..#..@......x#..#......................X.........................#####.......#..
..############..###############...####################.....#######...#########..
..............................#...#..................#.....#....................
..............................#+++#..................#+++++#....................
..............................#+++#..................#+++++#....................
..............................#####..................#######....................
................................................................................
................................................................................
`,`                                                                     
................................................................................
................................................................................
....###############################.............................................
...##.............................##########################################....
...#.......................................................................##...
...#....o...................................................................#...
...#...............x................................=.......................#...
...#.o........################...................o..o...........|........o..#...
...#.........................#.......x.................X....................#...
...#....o....................##########.....###################....##########...
...#..................................#+++++#.................#....#............
...###############....oo......=o.o.o..#######.###############.#....#............
.....#...............o..o.............#.......#......#........#....#............
.....#.............x......#############..######.####.#.########....########.....
.....#.............########..............#...........#.#..................#.....
.....#..........####......####...#####################.#..................#.....
.....#........###............###.......................########....########.....
.....#.......##................#########################......#....#............
.....#.......#................................................#....#............
.....###......................................................#....#............
.......#...............o...........................................#............
.......#....x..........x...............................o...........#............
.......#########......###.....############.........................##...........
.............#..................#........#####....#######.o.........########....
.............#++++++++++++++++++#............#....#.....#..................#....
.............#++++++++++++++++++#..........###....###...####.o.............#....
.............####################..........#........#......#.....|.........#....
...........................................#++++++++#......####............#....
...........................................#++++++++#.........#........@...#....
...........................................#++++++++#.........##############....
...........................................##########...........................
................................................................................
`,`
......................................#++#........................#######....................................#+#..
......................................#++#.....................####.....####.................................#+#..
......................................#++##########...........##...........##................................#+#..
......................................##++++++++++##.........##.............##...............................#+#..
.......................................##########++#.........#....................................o...o...o..#+#..
................................................##+#.........#.....o...o......................x.............##+#..
.................................................#+#.........#................................###############++#..
.................................................#v#.........#.....#...#........................++++++++++++++##..
.............................................................##..|...|...|..##............#####################...
..............................................................##+++++++++++##............v........................
...............................................................####+++++####......................................
...............................................#.....#............#######........###.........###..................
...............................................#.....#...........................#.#.........#.#..................
...............................................#.....#.............................#.........#....................
...............................................#.....#.............................##........#....................
...............................................##....#.............................#.........#....................
...................x...........................#.....#......o..o.....#...#.........#.........#....................
...............#######........###...###........#.....#.......x.......#...#.........#.........#....................
..............##.....##.........#...#..........#.....#.....######....#...#...#########.......#....................
.............##.......##........#.o.#..........#....##...............#...#...#...............#....................
.....@.......#.........#........#...#..........#.....#...............#...#...#......x........#....................
....###......#.........#........#...#..........#.....#...............#...#####...######......#....................
....#.#......#.........#.......##.o.##.........#.....#...............#.....o.....#.#.........#....................
++++#.#++++++#.........#++++++##.....##++++++++##....#++++++++++.....#..x..=.....#.#.........#....................
++++#.#++++++#.........#+++++##.......##########.....#+++++++##+.....#############.##..o.o..##....................
++++#.#++++++#.........#+++++#....o.................##++++++##.+....................##.....##.....................
++++#.#++++++#.........#+++++#.....................##++++++##..+.....................#######......................
++++#.#++++++#.........#+++++##.......##############++++++##...+..................................................
++++#.#++++++#.........#++++++#########++++++++++++++++++##....+..................................................
++++#.#++++++#.........#++++++++++++++++++++++++++++++++##.....+..................................................
`,`
..............................................................................................................
..............................................................................................................
..............................................................................................................
..............................................................................................................
..............................................................................................................
........................................o.....................................................................
..............................................................................................................
........................................#.....................................................................
........................................#.....................................................................
........................................#.....................................................................
........................................#.....................................................................
.......................................###....................................................................
.......................................#.#.................+++........+++..###................................
.......................................#.#.................+#+........+#+.....................................
.....................................###.###................#..........#......................................
......................................#...#.................#...oooo...#.......###............................
......................................#...#.................#......x...#......#+++#...........................
......................................#...#.................############.......###............................
.....................................##...##......#...#......#................................................
......................................#...#########...########..............#.#...............................
......................................#...#...........#....................#+++#..............................
......................................#...#...........#.....................###...............................
.....................................##...##..........#.......................................................
......................................#...#=.=.=.=....#............###........................................
......................................#...#...........#...........#+++#.......................................
......................................#...#....=.=.=.=#.....o......###.......###..............................
.....................................##...##..........#.....x...............#+++#.............................
..............................o...o...#...#...........#.....#................##v........###...................
......................................#...#...........#..............#.................#+++#..................
.............................###.###.###.###.....o.o..#++++++++++++++#...................v#...................
.............................#.###.#.#.###.#.........x#++++++++++++++#........................................
.............................#.............#...#######################........................................
.............................##...........##.........................................###......................
..###.........................#.....#.....#.........................................#+++#................###..
..#.#.........................#....###....#..........................................###.................#.#..
..#...........................#....###....#######........................#####.............................#..
..#...........................#...........#..............................#...#.............................#..
..#...........................##..........#..........x...................#.#.#.............................#..
..#.......................................#.......|####|....|####|.....###.###.............................#..
..#................###.............o.o....#..............................#.........###.....................#..
..#...............#####.......##..........#.............................###.......#+++#..........#.........#..
..#...............o###o.......#....###....#.............................#.#........###..........###........#..
..#................###........#############..#.oo.#....#.oo.#....#.oo..##.##....................###........#..
..#......@...X......#.........#...........#++#....#++++#....#++++#....##...##......x...x....x....#.x..x.x..#..
..#############################...........#############################.....################################..
..............................................................................................................
..............................................................................................................
`,`
..................................................................................................###.#.......
......................................................................................................#.......
..................................................................................................#####.......
..................................................................................................#...........
..................................................................................................#.###.......
..........................o.......................................................................#.#.#.......
.....................x.......................................................................o.o.o###.#.......
...................###.....................................................x...............x..........#.......
.......+..o..+................................................#####.#####.#####.#####.#####.#####.#####.......
.......#.....#................................................#...#.#...#.#...#.#...#.#...#.#...#.#...........
.......#=.o..#............#...................................###.#.###.#.###.#.###.#.###.#.###.#.#####.......
.......#.....#..................................................#.#...#.#...#.#...#.#...#.#...#.#.....#.......
.......+..o..+............o..................................####.#####.#####.#####.#####.#####.#######.......
..............................................................................................................
..........o..............###..............................##..................................................
..............................................................................................................
..............................................................................................................
......................................................##......................................................
...................###.........###............................................................................
..............................................................................................................
..........................o................................x....................#......#......................
..............x...........................................##.....##...........................................
.............###.........###.........###.................................#..................#.................
..............................................................................................................
.................................................................||...........................................
..###########........x...........X............................................................................
..#.........#.o.#########.o.#########.o.##................................................#...................
..#.........#...#.......#...#.......#...#.................||..................#.....#.........................
..#..@......#####...o...#####...o...#####.....................................................................
..#######.....................................#####.......##.....##.....###...................................
........#=.............x....=.......x........=#...#.....................###...................................
........#######################################...#+++++++++++++++++++++###+++++++++++++++++++++++++++++++++++
..................................................############################################################
..............................................................................................................
`];

let remainingLives = 3;

document.querySelector("button").addEventListener("click", event => {
    const code = document.querySelector("#code").value;
    if (code === "cheat") {
        document.querySelector(".stage-change").style.display = "inline";
        document.querySelector("#lives").removeAttribute("readonly");
    }
});

function changeHandler(event) {
    remainingLives = event.target.value;
}

document.querySelector("#lives").addEventListener("change", changeHandler);

runGame(GAME_LEVELS, DOMDisplay);