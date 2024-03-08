const W = 9;
const H = W;
const LevelDensity = 1 / 3;
const EnemyPeriod = 7;
const Enemies = ["abcde", "efghi", "ijklmno", "opqrstu", "uvwxy", "xyz"].map(cs => cs.split(""));

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

const Wall = {
    create(x, y) {
        return Object.assign(Object.create(this), { x, y });
    },

    render() {
        return `<span class="wall">#</span>`;
    },

    empty: false
};

const Floor = {
    create(x, y) {
        return Object.assign(Object.create(this), { glyph: Math.random() < 0.66 ? "." : "_", x, y });
    },

    render() {
        return this.creature?.render() ?? this.glyph;
    },

    empty: true
};

const Exit = Object.assign(Object.create(Floor), {
    create(x, y) {
        return Object.assign(Object.create(this), { glyph: "/", x, y });
    }
});

const Creature = {
    create(glyph) {
        return Object.assign(Object.create(this), { glyph });
    },

    get value() {
        return parseInt(this.glyph, 36);
    },

    canMove: true,

    set value(v) {
        const p = this.protected;
        this.glyph = v.toString(36);
        this.protected = p;
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

const Level = {
    create(w, h, d, i, avatarGlyph) {
        return Object.assign(Object.create(this), { w, h, i }).init(d, avatarGlyph);
    },

    alive: true,

    spawnCreature() {
        const c = Creature.create(randomItem(Enemies[this.i]));
        c.protected = Math.random() < 0.5;
        this.placeCreature(c, this.randomEmptyTile());
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
        return this;
    },

    render() {
        return this.tiles.map(
            (tile, i) => `${tile.render()}${(i + 1) % this.w === 0 ? "\n" : " "}`
        ).join("");
    },

    tick() {
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

        if (d.block) {
            // d is blocking (it already bumped into another creature) so
            // nothing happens and c becomes blocking in turn to prevent
            // chain reactions.
            c.block = true;
            return;
        }

        if (c.value === d.value) {
            // c moves forward and absorbs d; its strength increases (it either
            // becomes protected, or if it was, its value increases by one).
            // d absorbs c if it is protected and not c.
            delete this.tileOf(c).creature;
            if (d.protected && !c.protected) {
                d.value += 1;
                d.protected = false;
            } else {
                delete this.tileOf(d).creature;
                c.protected = !c.protected;
                if (!c.protected) {
                    c.value += 1;
                }
                this.placeCreature(c, this.tileOf(d));
            }
        } else {
            // Fight, both creatures get knocked down a notch, unless they
            // are protected (then they lose their protection). One creature
            // may die in the process; if it is d, then c replaces it.
            if (c.protected) {
                c.protected = false;
            } else {
                c.value -= 1;
                if (c.value < 10) {
                    delete this.tileOf(c).creature;
                }
            }
            if (d.protected) {
                d.protected = false;
                c.block = true;
            } else {
                d.value -= 1;
                if (d.value < 10) {
                    delete this.tileOf(c).creature;
                    delete this.tileOf(d).creature;
                    this.placeCreature(c, this.tileOf(d));
                } else {
                    c.block = true;
                }
            }
        }
    },

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

        // If the avatar became the strongest creature, the exit appears.
        if (!this.exit) {
            const strongest = creatures.reduce(
                (z, c) => (c.value > z.value) || (c.value === z.value && c.avatar) ? c : z,
                { value: 0 }
            );
            if (strongest?.avatar) {
                const tile = this.randomEmptyTile();
                if (tile) {
                    this.exit = Exit.create(tile.x, tile.y);
                    this.tiles[tile.x + tile.y * this.w] = this.exit;
                }
            }
        }

        // If there is no avatar creature left, this is game over.
        const avatarTiles = this.tiles.filter(c => c.creature?.avatar);
        if (avatarTiles.length === 0) {
            this.alive = false;
        } else if (this.exit) {
            for (const tile of avatarTiles) {
                if (tile === this.exit) {
                    this.won = tile.creature.glyph;
                    return;
                }
            }
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
    create(canvas, w, h, d) {
        return Object.assign(Object.create(this), { canvas, w, h, d }).init("a");
    },

    init(avatarGlyph) {
        document.addEventListener("keydown", this);
        document.addEventListener("keyup", this);
        document.addEventListener("pointerdown", this);
        return this.newLevel(avatarGlyph, 0);
    },

    newLevel(avatarGlyph, i) {
        this.i = i;
        this.level = Level.create(this.w, this.h, this.d, i, avatarGlyph);
        return this;
    },

    gameOver() {
        document.removeEventListener("keydown", this);
        document.removeEventListener("keyup", this);
        document.removeEventListener("pointerdown", this);
        this.canvas.classList.add("game-over");
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
            if (this.level.won) {
                this.newLevel(this.level.won, Math.min(this.i + 1, Enemies.length - 1)).tick();
            } else {
                this.level.tick();
            }
        } else {
            this.gameOver();
        }
        this.canvas.innerHTML = this.level.render();
    }
};

Game.create(document.querySelector("pre.canvas"), W, H, LevelDensity).tick();
