const W = 9;
const H = W;
const D = 1 / 3;

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
        return Object.assign(Object.create(this), { glyph: " " /*Math.random() < 0.5 ? "." : "_"*/, x, y });
    },

    render() {
        return this.creature?.render() ?? this.glyph;
    },

    empty: true
};

const Creature = {
    create(glyph) {
        return Object.assign(Object.create(this), { glyph });
    },

    get value() {
        return parseInt(this.glyph.replace(/@/, "9"), 36) - 10;
    },

    set value(v) {
        const p = this.protected;
        this.glyph = (v + 10).toString(36);
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
    create(w, h, d) {
        let tiles;
        do { tiles = randomGrid(w, h, d); } while (!connected(tiles, w));
        return Object.assign(Object.create(this), { w, h, tiles });
    },

    render() {
        return this.tiles.map(
            (tile, i) => `${tile.render()}${(i + 1) % this.w === 0 ? "\n" : " "}`
        ).join("");
    },

    randomEmptyTile() {
        return randomItem(this.tiles.filter(tile => tile.empty && !tile.creature));
    },

    // Resolve conflict of creature c trying to move to a space occupied by
    // creature d.
    resolveConflict(c, d) {

        // If c was the avatar and it was deleted, actually delete d.
        const fixAvatar = () => {
            if (c.avatar) {
                console.info("Fix avatar!");
                delete this.tileOf(d).creature;
                c.glyph = d.glyph;
                this.placeCreature(c, this.tileOf(d));
            }
        }

        if (c.value === d.value) {
            // Same value: merge and become/stay protected
            delete this.tileOf(c).creature;
            d.protected = true;
            fixAvatar();
        } else if (c.value - d.value === 1) {
            // Increasing value: become even stronger (c is strongest)
            delete this.tileOf(c).creature;
            d.protected = d.protected && c.protected;
            d.value = c.value + 1;
            fixAvatar();
        } else if (d.value - c.value === 1) {
            // Increasing value: become even stronger (d is strongest)
            delete this.tileOf(c).creature;
            d.protected = d.protected && c.protected;
            d.value += 1;
            fixAvatar();
        } else {
            // Fight, both creatures get knocked down a notch, unless they
            // are protected (then they lose their protection).
            if (c.protected) {
                c.protected = false;
            } else if (c.value <= 0) {
                delete this.tileOf(c).creature;
            } else {
                c.value -= 1;
            }
            if (d.protected) {
                d.protected = false;
            } else if (d.value <= 0) {
                delete this.tileOf(c).creature;
                delete this.tileOf(d).creature;
                this.placeCreature(c, this.tileOf(d));
            } else {
                d.value -= 1;
            }
        }
    },

    moveCreatures(creatures, diff) {
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
        const game = Object.create(this);
        game.canvas = canvas;
        game.level = Level.create(w, h, d);
        const avatar = Creature.create("@");
        avatar.avatar = true;
        game.level.placeCreature(avatar, game.level.randomEmptyTile());
        game.level.placeCreature(Creature.create("a"), game.level.randomEmptyTile());
        game.level.placeCreature(Creature.create("b"), game.level.randomEmptyTile());
        game.level.placeCreature(Creature.create("e"), game.level.randomEmptyTile());
        document.addEventListener("keydown", game);
        document.addEventListener("keyup", game);
        document.addEventListener("pointerdown", game);
        game.t = 0;
        return game;
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
                this.render();
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
            this.render();
        }
        event.preventDefault();
    },

    render() {
        this.t += 1;
        const r = 10 * Math.random();
        console.log(this.t, r);
        if (r < this.t) {
            this.t = 0;
            this.level.placeCreature(
                Creature.create(randomItem("cdef".split(""))),
                this.level.randomEmptyTile()
            );
        }
        this.canvas.innerHTML = this.level.render();
    }
};

Game.create(document.querySelector("pre.canvas"), W, H, D).render();
