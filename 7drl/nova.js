const Sizes = [9, 9, 8, 8, 7, 6, 6];
const Densities = [1/3, 1/3, 1/4, 1/4, 1/5, 0, 0];
const EnemyPeriod = 7;
const Enemies = [
    "aabccde",
    "effghhi",
    "ijklmno",
    "opqrstu",
    "uuvwxxy",
    "xxxyyyz",
    "aaaaaaa"
].map(cs => cs.split(""));
const TargetValues = "eiouyzz".split("").map(c => parseInt(c, 36));

const randomInt = n => Math.floor(Math.random() * n);
const randomItem = items => items[randomInt(items.length)];
const around = (x, y, threshold = 0.25) => Math.abs(x - y) < threshold;

const randomGrid = (w, h, d) => new Array(w * h).fill().map(
    (_, i) => {
        const x = i % w;
        const y = Math.floor(i / h);
        return (x === 0 || y === 0 || x >= (w - 1) || y >= (h - 1) || Math.random() < d ? Wall : Floor).
            create(x, y);
    }
);

function connected(tiles, w) {
    function findSet(t) {
        for (; parents.get(t) !== t; t = parents.get(t)) {}
        return t;
    }

    function connect(t, u) {
        if (u.empty) {
            parents.set(findSet(t), findSet(u));
        }
    }

    const emptyTiles = tiles.filter(tile => tile.empty);
    const parents = new Map();
    for (const tile of emptyTiles) {
        parents.set(tile, tile);
    }
    for (const tile of emptyTiles) {
        const i = tile.x + tile.y * w;
        connect(tile, tiles[i - w]);
        connect(tile, tiles[i - 1]);
    }
    const roots = new Set();
    for (const tile of emptyTiles) {
        roots.add(findSet(tile));
    }
    console.info(`Components: ${roots.size}`);
    return roots.size === 1;
}

const extend = (object, properties) => Object.assign(Object.create(object), properties);

const Wall = {
    create(x, y) {
        return extend(this, { x, y });
    },

    render() {
        return `<span class="wall">#</span>`;
    },

    empty: false
};

const Floor = {
    create(x, y) {
        return extend(this, { glyph: randomItem("...__,".split("")), x, y });
    },

    render() {
        return this.creature?.render() ?? `<span class="floor">${this.glyph}</span>`;
    },

    empty: true
};

const Creature = {
    create(glyph) {
        return extend(this, { glyph });
    },

    get value() {
        return parseInt(this.glyph, 36);
    },

    set value(v) {
        if (v > 35) {
            this.protected = true;
        } else {
            this.glyph = v.toString(36);
            this.protected = false;
        }
    },

    get protected() {
        return /[A-Z]/.test(this.glyph);
    },

    set protected(p) {
        if (p) {
            this.glyph = this.glyph.toUpperCase();
        } else {
            this.glyph = this.glyph.toLowerCase();
        }
    },

    render() {
        return this.avatar ? `<span class="avatar">${this.glyph}</span>` : this.glyph;
    }
};

const effect = (glyph, consumeEffect) => extend(Creature, {
    create() {
        return extend(this, { glyph });
    },

    consumeEffect
});

// Exit: moves the creature to the next level; this is what the player wants
// to do.
const Exit = effect("/", function(c, level) {
    if (c.avatar) {
        level.up = c.glyph;
    } else {
        delete level.tileOf(c).creature;
    }
    return false;
});

// Avatarize: toggles the avatar switch of the creature.
const Avatar = effect("@", function(c, level) {
    c.avatar = !c.avatar;
    return true;
});

// Buff: increase the protection/value of the creature.
const Buff = effect("+", function(c) {
    c.protected = !c.protected;
    if (!c.protected) {
        c.value += 1;
    }
    return true;
});

// Debuff: decrease the protection/value of the creature.
const Debuff = effect("-", function(c) {
    if (c.protected) {
        c.protected = false;
    } else {
        c.value -= 1;
    }
    return true;
});

// Split: split the creature in two; if protected, it maintains its level,
// otherwise it gets split into two smaller ones (except a, which survives
// and is split into a’s).
const Split = effect("%", function(c, level) {
    if (!c.protected && c.value > 10) {
        c.value -= 1;
    } else {
        c.protected = false;
    }
    delete level.tileOf(this).creature;
    const d = Creature.create(c.glyph);
    if (c.avatar) {
        d.avatar = true;
    }
    level.placeCreature(d, level.tileOf(this));
    return false;
});

// Teleport: transport creature to a random empty tile. May affect protection
// as a side effect (?!)
const Teleport = effect("~", function(c, level) {
    const origin = level.tileOf(c);
    delete level.tileOf(c).creature;
    delete level.tileOf(this).creature;
    level.teleport(c);
});

// Trap: go down one level (or die at the lowest), but only works once.
const Trap = effect("\\", function(c, level) {
    delete level.tileOf(c).creature;
    delete level.tileOf(this).creature;
    if (c.avatar) {
        level.down = c.glyph;
    }
    return false;
});

// Random: bump once to reveal.
const Random = effect("?", function(c, level) {
    delete level.tileOf(this).creature;
    level.placeCreature(randomItem(Effects).create(), level.tileOf(this));
    return false;
});

const Effects = [Avatar, Buff, Debuff, Split, Teleport, Trap];
const SpawnEffects = [Random, ...Effects];
const Levels = Enemies.map((creatures, i) => ({
    spawns: [
        ...creatures.map(glyph => () => Creature.create(glyph)),
        ...SpawnEffects.map(f => () => f.create())
    ],
    targetValue: TargetValues[i],
    w: Sizes[i],
    h: Sizes[i],
    d: Densities[i]
}));

const Level = {
    create({ spawns, targetValue, w, h, d }, avatarGlyph) {
        return extend(this, { spawns, targetValue, w, h }).init(d, avatarGlyph);
    },

    init(d, avatarGlyph) {
        do { this.tiles = randomGrid(this.w, this.h, d); } while (!connected(this.tiles, this.w));
        const avatar = Creature.create(avatarGlyph);
        avatar.avatar = true;
        this.placeCreature(avatar, this.randomEmptyTile());
        for (let i = 0; i < EnemyPeriod; ++i) {
            this.spawnCreature();
        }
        this.t = 0;
        this.teleportQueue = [];
        return this;
    },

    alive: true,

    spawnCreature() {
        this.placeRandomly(randomItem(this.spawns)());
    },

    placeRandomly(c) {
        if (typeof c.consumeEffect !== "function") {
            c.protected = Math.random() < 0.5;
        }
        return this.placeCreature(c, this.randomEmptyTile());
    },

    render() {
        return this.tiles.map(
            (tile, i) => `${tile.render()}${(i + 1) % this.w === 0 ? "\n" : " "}`
        ).join("");
    },

    teleport(c) {
        this.teleportQueue.push(c);
    },

    tick() {
        this.teleportQueue.length = 0;
        this.t += 1;
        const r = EnemyPeriod * Math.random();
        if (r < this.t) {
            this.t = 0;
            this.spawnCreature();
        }
    },

    randomEmptyTile() {
        return randomItem(this.tiles.filter(tile => tile.empty && !tile.creature));
    },

    // Resolve conflict of creature c trying to move to a space occupied by
    // creature d.
    resolveConflict(c, d) {

        if (typeof c.consumeEffect === "function") {
            // No effect.
            return;
        }

        if (typeof d.consumeEffect === "function") {
            // c is a regular creature so the effect applies and may be
            // consumed by the creature.
            if (d.consumeEffect(c, this)) {
                if (c.value < 10) {
                    // c did not survive the effect!
                    delete this.tileOf(c).creature;
                } else {
                    this.replaceCreature(c, d);
                }
            }
            c.block = true;
            return;
        }

        if (d.block) {
            return;
        }

        if (c.value === d.value) {
            // c moves forward and absorbs d; its value increases. d absorbs c
            // if it is protected and not c.
            delete this.tileOf(c).creature;
            if (d.protected && !c.protected) {
                d.protected = false;
                d.value += 1;
            } else {
                delete this.tileOf(d).creature;
                c.protected = false;
                c.value += 1;
                this.placeCreature(c, this.tileOf(d));
            }
        } else if (c.value > d.value) {
            // c attacks d as it is stronger; if d is protected, c also loses
            // a bit in the attack when destroying d’s protection.
            if (d.protected) {
                d.protected = false;
                if (c.protected) {
                    c.protected = false;
                } else {
                    c.value -= 1;
                }
                c.block = true;
            } else {
                d.value -= 1;
                if (d.value < 10) {
                    this.replaceCreature(c, d);
                } else {
                    c.block = true;
                }
            }
        } else if (c.protected && !d.protected) {
            // c bumps into a stronger d; it can chip it if it is protected.
            c.protected = false;
            d.value -= 1;
            c.block = true;
        }
    },

    // Replace creature d with c.
    replaceCreature(c, d) {
        delete this.tileOf(c).creature;
        delete this.tileOf(d).creature;
        this.placeCreature(c, this.tileOf(d));
    },

    // Move all creatures in the same direction.
    moveCreatures(creatures, diff) {
        for (const creature of creatures) {
            // Clear the block flag from last turn.
            delete creature.block;
        }
        for (const creature of creatures) {
            const i = creature.x + creature.y * this.w;
            const dest = this.tiles[i + diff];
            if (dest.empty) {
                if (!dest.creature) {
                    delete this.tiles[i].creature;
                    this.placeCreature(creature, dest);
                } else {
                    this.resolveConflict(creature, dest.creature);
                }
            }
        }

        // Teleport creatures
        for (const c of this.teleportQueue) {
            this.placeRandomly(c);
        }

        // If there is no avatar creature left, this is game over. If one
        // avatar reaches the target level, then the exit appears.
        const avatarTiles = this.tiles.filter(c => c.creature?.avatar);
        if (avatarTiles.length === 0) {
            this.alive = false;
        } else if (!this.exit && avatarTiles.find(c => c.creature.value >= this.targetValue)) {
            this.exit = this.placeRandomly(Exit.create());
        }
    },

    get creatures() {
        return this.tiles.map(tile => tile.creature).filter(c => !!c);
    },

    moveUp() {
        this.moveCreatures(this.creatures.toSorted((a, b) => a.y - b.y), -this.w);
    },

    moveDown() {
        this.moveCreatures(this.creatures.toSorted((a, b) => b.y - a.y), this.w);
    },

    moveLeft() {
        this.moveCreatures(this.creatures.toSorted((a, b) => a.x - b.x), -1);
    },

    moveRight() {
        this.moveCreatures(this.creatures.toSorted((a, b) => b.x - a.x), 1);
    },

    placeCreature(creature, tile) {
        creature.x = tile.x;
        creature.y = tile.y;
        tile.creature = creature;
        return creature;
    },

    tileOf(creature) {
        return this.tiles[creature.x + creature.y * this.w];
    }
};

const Game = {
    create(canvas) {
        return extend(this, { canvas }).init("a");
    },

    init(avatarGlyph) {
        document.addEventListener("keydown", this);
        document.addEventListener("keyup", this);
        document.addEventListener("pointerdown", this);
        return this.newLevel(avatarGlyph, 0);
    },

    newLevel(avatarGlyph, i) {
        setTimeout(() => alert(`Level ${i + 1}`), 50);
        this.i = i;
        this.level = Level.create(Levels[i], avatarGlyph);
        return this;
    },

    gameOver(won) {
        document.removeEventListener("keydown", this);
        document.removeEventListener("keyup", this);
        document.removeEventListener("pointerdown", this);
        this.canvas.classList.add("game-over");
        this.canvas.classList.toggle("won", won);
        setTimeout(() => alert(won ? "You win!" : "Game Over"), 50);
    },

    handleEvent(event) {
        switch (event.type) {
            case "keydown":
            case "keyup":
                this.handleKey(event);
                break;

            case "pointerdown":
                this.x0 = event.clientX;
                this.y0 = event.clientY;
                document.addEventListener("pointermove", this, { passive: false });
                document.addEventListener("pointercancel", this);
                document.addEventListener("pointerup", this);
                event.preventDefault();
                break;
            case "pointermove":
                this.theta = Math.atan2(event.clientY - this.y0, event.clientX - this.x0);
                event.preventDefault();
                break;
            case "pointercancel":
            case "pointerup":
                event.preventDefault();
                const th = this.theta / Math.PI;
                delete this.x0;
                delete this.y0;
                delete this.theta;
                if (around(th, -0.5)) {
                    this.level.moveUp();
                } else if (around(th, 0.5)) {
                    this.level.moveDown();
                } else if (around(Math.abs(th), 1)) {
                    this.level.moveLeft();
                } else if (around(th, 0)) {
                    this.level.moveRight();
                } else {
                    return;
                }
                this.tick();
                break;
        }
    },

    handleKey(event) {
        if (event.type === "keydown") {
            switch (event.key) {
                case "ArrowUp":
                case "ArrowDown":
                case "ArrowLeft":
                case "ArrowRight":
                    break;
                default:
                    return;
            }
        } else {
            switch (event.key) {
                case "ArrowUp":
                    this.level.moveUp();
                    break;
                case "ArrowDown":
                    this.level.moveDown();
                    break;
                case "ArrowLeft":
                    this.level.moveLeft();
                    break;
                case "ArrowRight":
                    this.level.moveRight();
                    break;
                default:
                    return;
            }
            this.tick();
        }
        event.preventDefault();
    },

    tick() {
        if (this.level.alive) {
            if (this.level.up) {
                if (this.level.up === "Z") {
                    this.gameOver(true);
                } else {
                    this.newLevel(this.level.up, Math.min(this.i + 1, Levels.length - 1)).tick();
                }
            } else {
                this.level.tick();
            }
        } else if (this.level.down) {
            if (this.i === 0) {
                this.gameOver(false);
            } else {
                this.newLevel(this.level.down, this.i - 1);
            }
        } else {
            this.gameOver(false);
        }
        this.canvas.innerHTML = this.level.render();
    }
};

Game.create(document.querySelector("pre.canvas")).tick();
