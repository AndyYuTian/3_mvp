// BoardData.ts
// 纯逻辑层：棋盘数据、消除检测、下落补充
// 不依赖任何 Cocos API，方便单独测试

import { TileType, TILE_COUNT, TileCell } from "./TileData";

export interface MatchResult {
    matched: TileCell[];   // 本次消除的所有格子
    score:   number;       // 本次得分
}

export interface FallResult {
    moved: { cell: TileCell; fromRow: number }[]; // 下落的格子及原始行
    added: TileCell[];                             // 新补充的格子
}

export class BoardData {
    readonly rows: number;
    readonly cols: number;
    private grid: TileType[][];

    constructor(rows = 6, cols = 6) {
        this.rows = rows;
        this.cols = cols;
        this.grid = [];
        this.init();
    }

    // ─── 初始化 ────────────────────────────────────────────────

    init(): void {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                // 生成时避免初始就出现三连
                this.grid[r][c] = this.randomTypeAvoidingMatch(r, c);
            }
        }
    }

    private randomTypeAvoidingMatch(row: number, col: number): TileType {
        const forbidden = new Set<TileType>();

        // 检查左边两格
        if (col >= 2 &&
            this.grid[row][col - 1] === this.grid[row][col - 2]) {
            forbidden.add(this.grid[row][col - 1]);
        }
        // 检查上边两格
        if (row >= 2 &&
            this.grid[row - 1][col] === this.grid[row - 2][col]) {
            forbidden.add(this.grid[row - 1][col]);
        }

        let type: TileType;
        let attempts = 0;
        do {
            type = (Math.floor(Math.random() * TILE_COUNT) + 1) as TileType;
            attempts++;
        } while (forbidden.has(type) && attempts < 20);

        return type;
    }

    // ─── 读写格子 ──────────────────────────────────────────────

    getType(row: number, col: number): TileType {
        return this.grid[row]?.[col] ?? TileType.None;
    }

    setType(row: number, col: number, type: TileType): void {
        if (this.inBounds(row, col)) this.grid[row][col] = type;
    }

    inBounds(row: number, col: number): boolean {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }

    // ─── 交换 ──────────────────────────────────────────────────

    swap(r1: number, c1: number, r2: number, c2: number): void {
        const tmp = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = tmp;
    }

    isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
        return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    }

    // ─── 消除检测 ──────────────────────────────────────────────

    // 返回当前棋盘上所有可消除的格子（不执行消除）
    findAllMatches(): TileCell[] {
        const matched = new Set<string>();
        const result: TileCell[] = [];

        const key = (r: number, c: number) => `${r},${c}`;
        const add = (r: number, c: number) => {
            const k = key(r, c);
            if (!matched.has(k)) {
                matched.add(k);
                result.push({ type: this.grid[r][c], row: r, col: c });
            }
        };

        // 横向三连
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c <= this.cols - 3; c++) {
                const t = this.grid[r][c];
                if (t === TileType.None) continue;
                if (t === this.grid[r][c + 1] && t === this.grid[r][c + 2]) {
                    // 继续向右扩展
                    let len = 3;
                    while (c + len < this.cols && this.grid[r][c + len] === t) len++;
                    for (let i = 0; i < len; i++) add(r, c + i);
                }
            }
        }

        // 纵向三连
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r <= this.rows - 3; r++) {
                const t = this.grid[r][c];
                if (t === TileType.None) continue;
                if (t === this.grid[r + 1][c] && t === this.grid[r + 2][c]) {
                    let len = 3;
                    while (r + len < this.rows && this.grid[r + len][c] === t) len++;
                    for (let i = 0; i < len; i++) add(r + i, c);
                }
            }
        }

        return result;
    }

    // 执行消除：把匹配的格子设为 None，返回得分
    applyMatch(cells: TileCell[]): number {
        cells.forEach(cell => {
            this.grid[cell.row][cell.col] = TileType.None;
        });
        // 计分：3 连 = 30，每多 1 个 +15
        const bonus = Math.max(0, cells.length - 3);
        return 30 + bonus * 15;
    }

    // ─── 下落 + 补充 ───────────────────────────────────────────

    // 让 None 上方的方块下落，返回下落信息和新补充的格子
    applyFall(): FallResult {
        const moved: FallResult["moved"] = [];
        const added: TileCell[] = [];

        for (let c = 0; c < this.cols; c++) {
            // 从底行向上扫描，把非 None 方块向下移
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] !== TileType.None) {
                    if (r !== writeRow) {
                        moved.push({
                            cell: { type: this.grid[r][c], row: writeRow, col: c },
                            fromRow: r,
                        });
                        this.grid[writeRow][c] = this.grid[r][c];
                        this.grid[r][c] = TileType.None;
                    }
                    writeRow--;
                }
            }
            // 顶部空位补充新方块
            for (let r = writeRow; r >= 0; r--) {
                const type = (Math.floor(Math.random() * TILE_COUNT) + 1) as TileType;
                this.grid[r][c] = type;
                added.push({ type, row: r, col: c });
            }
        }

        return { moved, added };
    }

    // ─── 是否有可行交换 ────────────────────────────────────────

    // 检查棋盘是否还有任何合法操作（死局检测）
    hasValidMove(): boolean {
        const dirs = [[0, 1], [1, 0]];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                for (const [dr, dc] of dirs) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (!this.inBounds(nr, nc)) continue;

                    this.swap(r, c, nr, nc);
                    const matches = this.findAllMatches();
                    this.swap(r, c, nr, nc); // 换回来

                    if (matches.length > 0) return true;
                }
            }
        }
        return false;
    }

    // ─── 调试用 ────────────────────────────────────────────────

    print(): void {
        const symbols = [".", "G", "D", "V", "M", "N"];
        for (let r = 0; r < this.rows; r++) {
            console.log(this.grid[r].map(t => symbols[t]).join(" "));
        }
    }
}
