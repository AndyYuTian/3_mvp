// BoardController.ts
// Cocos Creator 3.8 节点层
// 负责：渲染方块、处理点击交互、播放动画
// 挂载到场景中的 Board 节点上

import {
    _decorator, Component, Node, Color, UITransform,
    Graphics, Vec3, tween, v3, Tween
} from "cc";
import { BoardData, FallResult } from "./BoardData";
import { TileType, TILE_COLORS, TileCell } from "./TileData";

const { ccclass, property } = _decorator;

// 交换完成后的回调类型
export type SwapCallback = (matched: TileCell[], score: number, isChain: boolean) => void;
export type DeadlockCallback = () => void;

@ccclass("BoardController")
export class BoardController extends Component {

    @property({ tooltip: "棋盘行数" })
    rows: number = 6;

    @property({ tooltip: "棋盘列数" })
    cols: number = 6;

    @property({ tooltip: "单个方块的像素尺寸" })
    tileSize: number = 80;

    @property({ tooltip: "方块间距" })
    tileGap: number = 4;

    // ─── 内部状态 ──────────────────────────────────────────────

    private data!: BoardData;
    private tileNodes: Node[][] = [];   // [row][col] → Node
    private selected: { row: number; col: number } | null = null;
    private isLocked = false;           // 动画播放期间锁定输入

    private onMatchCallback: SwapCallback | null = null;
    private onDeadlockCallback: DeadlockCallback | null = null;

    // ─── 生命周期 ──────────────────────────────────────────────

    onLoad() {
        this.data = new BoardData(this.rows, this.cols);
        this.buildVisual();
    }

    // 注册回调，供 GameManager 使用
    setCallbacks(onMatch: SwapCallback, onDeadlock: DeadlockCallback) {
        this.onMatchCallback = onMatch;
        this.onDeadlockCallback = onDeadlock;
    }

    // ─── 构建视觉 ──────────────────────────────────────────────

    private buildVisual() {
        const step = this.tileSize + this.tileGap;
        const totalW = this.cols * step - this.tileGap;
        const totalH = this.rows * step - this.tileGap;

        // 以棋盘中心为原点，左上角起始偏移
        const startX = -totalW / 2 + this.tileSize / 2;
        const startY =  totalH / 2 - this.tileSize / 2;

        this.tileNodes = [];
        for (let r = 0; r < this.rows; r++) {
            this.tileNodes[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const node = this.createTileNode(r, c);
                const x = startX + c * step;
                const y = startY - r * step;
                node.setPosition(x, y, 0);
                this.node.addChild(node);
                this.tileNodes[r][c] = node;
            }
        }
    }

    // 用 Graphics 组件画一个圆角矩形方块（占位阶段，后期换 Sprite）
    private createTileNode(row: number, col: number): Node {
        const type = this.data.getType(row, col);
        const node = new Node(`tile_${row}_${col}`);

        const ui = node.addComponent(UITransform);
        ui.setContentSize(this.tileSize, this.tileSize);

        const g = node.addComponent(Graphics);
        this.drawTile(g, type);

        // 点击事件（微信小游戏用 touch 事件）
        node.on(Node.EventType.TOUCH_END, () => {
            this.onTileTouch(row, col);
        });

        return node;
    }

    private drawTile(g: Graphics, type: TileType, selected = false) {
        g.clear();
        const hex = TILE_COLORS[type] ?? "#888888";
        const color = new Color();
        Color.fromHEX(color, hex);

        // 选中时画外框
        if (selected) {
            g.strokeColor = Color.WHITE;
            g.lineWidth = 4;
            g.roundRect(
                -this.tileSize / 2 - 2, -this.tileSize / 2 - 2,
                this.tileSize + 4, this.tileSize + 4, 10
            );
            g.stroke();
        }

        g.fillColor = color;
        g.roundRect(
            -this.tileSize / 2, -this.tileSize / 2,
            this.tileSize, this.tileSize, 8
        );
        g.fill();
    }

    // ─── 交互处理 ──────────────────────────────────────────────

    private onTileTouch(row: number, col: number) {
        if (this.isLocked) return;

        if (!this.selected) {
            // 第一次点击：选中
            this.selected = { row, col };
            this.highlightTile(row, col, true);
        } else {
            const { row: sr, col: sc } = this.selected;

            if (sr === row && sc === col) {
                // 点同一格：取消选中
                this.highlightTile(sr, sc, false);
                this.selected = null;
                return;
            }

            if (this.data.isAdjacent(sr, sc, row, col)) {
                // 相邻：尝试交换
                this.highlightTile(sr, sc, false);
                this.selected = null;
                this.trySwap(sr, sc, row, col);
            } else {
                // 不相邻：切换选中
                this.highlightTile(sr, sc, false);
                this.selected = { row, col };
                this.highlightTile(row, col, true);
            }
        }
    }

    private highlightTile(row: number, col: number, on: boolean) {
        const node = this.tileNodes[row][col];
        const g = node.getComponent(Graphics)!;
        this.drawTile(g, this.data.getType(row, col), on);

        // 选中时轻微放大
        const scale = on ? 1.08 : 1.0;
        tween(node).to(0.1, { scale: v3(scale, scale, 1) }).start();
    }

    // ─── 核心流程：交换 → 消除 → 下落 → 循环 ─────────────────

    private async trySwap(r1: number, c1: number, r2: number, c2: number) {
        this.isLocked = true;

        // 1. 执行交换动画
        await this.animateSwap(r1, c1, r2, c2);
        this.data.swap(r1, c1, r2, c2);

        // 2. 检查是否有消除
        const matches = this.data.findAllMatches();
        if (matches.length === 0) {
            // 无效交换：换回来
            await this.animateSwap(r1, c1, r2, c2);
            this.data.swap(r1, c1, r2, c2);
            this.isLocked = false;
            return;
        }

        // 3. 连锁消除循环
        let isChain = false;
        let totalScore = 0;
        let allMatched: TileCell[] = [];

        let toProcess = matches;
        while (toProcess.length > 0) {
            // 消除
            const score = this.data.applyMatch(toProcess);
            totalScore += score;
            allMatched = allMatched.concat(toProcess);
            await this.animateRemove(toProcess);

            // 下落
            const fallResult = this.data.applyFall();
            await this.animateFall(fallResult);

            // 再次检查连锁
            toProcess = this.data.findAllMatches();
            if (toProcess.length > 0) isChain = true;
        }

        // 4. 通知 GameManager
        this.onMatchCallback?.(allMatched, totalScore, isChain);

        // 5. 检查死局
        if (!this.data.hasValidMove()) {
            this.onDeadlockCallback?.();
        }

        this.isLocked = false;
    }

    // ─── 动画 ──────────────────────────────────────────────────

    private animateSwap(r1: number, c1: number, r2: number, c2: number): Promise<void> {
        const n1 = this.tileNodes[r1][c1];
        const n2 = this.tileNodes[r2][c2];
        const p1 = n1.position.clone();
        const p2 = n2.position.clone();

        // 交换节点位置引用
        this.tileNodes[r1][c1] = n2;
        this.tileNodes[r2][c2] = n1;

        return new Promise(resolve => {
            let done = 0;
            const check = () => { if (++done === 2) resolve(); };
            tween(n1).to(0.18, { position: p2 }, { easing: "quadOut" }).call(check).start();
            tween(n2).to(0.18, { position: p1 }, { easing: "quadOut" }).call(check).start();
        });
    }

    private animateRemove(cells: TileCell[]): Promise<void> {
        return new Promise(resolve => {
            let done = 0;
            const total = cells.length;
            cells.forEach(cell => {
                const node = this.tileNodes[cell.row][cell.col];
                tween(node)
                    .to(0.15, { scale: v3(1.2, 1.2, 1) }, { easing: "quadOut" })
                    .to(0.1,  { scale: v3(0, 0, 1) },     { easing: "quadIn" })
                    .call(() => {
                        // 重绘为空（不销毁节点，后面下落会复用）
                        const g = node.getComponent(Graphics)!;
                        g.clear();
                        if (++done === total) resolve();
                    })
                    .start();
            });
        });
    }

    private animateFall(result: FallResult): Promise<void> {
        const step = this.tileSize + this.tileGap;
        const startY = (this.rows / 2 - 0.5) * step;
        const startX = -(this.cols / 2 - 0.5) * step;
    
        const promises: Promise<void>[] = [];
    
        // ─── 关键：先构建新的 tileNodes 映射，避免引用覆盖 ───
    
        // 1. 收集所有需要保留的节点（从下落和静止的格子中）
        const newTileNodes: Node[][] = [];
        for (let r = 0; r < this.rows; r++) {
            newTileNodes[r] = new Array(this.cols);
        }
    
        // 2. 先处理下落的方块：从 fromRow 移动到 cell.row
        result.moved.forEach(({ cell, fromRow }) => {
            const node = this.tileNodes[fromRow][cell.col];
            newTileNodes[cell.row][cell.col] = node;
    
            const targetY = startY - cell.row * step;
            promises.push(new Promise(resolve => {
                tween(node)
                    .to(0.2, { position: v3(node.position.x, targetY, 0) },
                        { easing: "quadIn" })
                    .call(resolve)
                    .start();
            }));
        });
    
        // 3. 处理没有移动、也没有被消除的方块（静止不动的）
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (newTileNodes[r][c]) continue; // 已经被下落方块占了
    
                // 当前位置如果有节点且未被消除（scale != 0），保留
                const existing = this.tileNodes[r][c];
                if (existing && existing.isValid && existing.scale.x > 0) {
                    // 检查它不是已经被 moved 列表认领过的源节点
                    const isSourceOfMove = result.moved.some(
                        m => m.fromRow === r && m.cell.col === c
                    );
                    if (!isSourceOfMove) {
                        newTileNodes[r][c] = existing;
                    }
                }
            }
        }
    
        // 4. 处理新补充方块：复用被消除的节点（scale=0 的），重新绘制并下落
        result.added.forEach(cell => {
            // 找一个未被使用的节点来复用（原本被消除的节点）
            let reuseNode: Node | null = null;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const n = this.tileNodes[r][c];
                    if (!n || !n.isValid) continue;
                    // 检查这个节点没有被新数组引用
                    const isUsed = newTileNodes.some(row => row.includes(n));
                    if (!isUsed && n.scale.x === 0) {
                        reuseNode = n;
                        break;
                    }
                }
                if (reuseNode) break;
            }
    
            // 如果找不到可复用的节点，新建一个
            if (!reuseNode) {
                reuseNode = this.createTileNode(cell.row, cell.col);
                this.node.addChild(reuseNode);
            }
    
            newTileNodes[cell.row][cell.col] = reuseNode;
    
            const targetY = startY - cell.row * step;
            const targetX = startX + cell.col * step;
            const spawnY = startY + this.tileSize * 2;
    
            // 重绘并重置缩放
            const g = reuseNode.getComponent(Graphics)!;
            this.drawTile(g, cell.type);
            reuseNode.scale = v3(1, 1, 1);
            reuseNode.setPosition(targetX, spawnY, 0);
    
            // 重新绑定点击事件到新位置
            reuseNode.off(Node.EventType.TOUCH_END);
            const r = cell.row, c = cell.col;
            reuseNode.on(Node.EventType.TOUCH_END, () => {
                this.onTileTouch(r, c);
            });
    
            promises.push(new Promise(resolve => {
                tween(reuseNode!)
                    .to(0.25, { position: v3(targetX, targetY, 0) },
                        { easing: "quadIn" })
                    .call(resolve)
                    .start();
            }));
        });
    
        // 5. 替换整个 tileNodes 数组
        this.tileNodes = newTileNodes;
    
        // 6. 关键：所有幸存节点的点击事件要重新绑定到新坐标
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const node = this.tileNodes[r][c];
                if (!node || !node.isValid) continue;
                // 检查是否是新补充的（新补充的已经在上面绑定了）
                const isNewlyAdded = result.added.some(
                    cell => cell.row === r && cell.col === c
                );
                if (isNewlyAdded) continue;
    
                node.off(Node.EventType.TOUCH_END);
                node.on(Node.EventType.TOUCH_END, () => {
                    this.onTileTouch(r, c);
                });
            }
        }
    
        return Promise.all(promises).then(() => {});
    }
    
    // ─── 外部调用：重置棋盘 ────────────────────────────────────

    resetBoard() {
        Tween.stopAllByTarget(this.node);
        this.tileNodes.flat().forEach(n => n.destroy());
        this.tileNodes = [];
        this.selected = null;
        this.isLocked = false;
        this.data.init();
        this.buildVisual();
    }
}
