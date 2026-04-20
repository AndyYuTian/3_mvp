// GameManager.ts
// 关卡状态管理器
// 负责：步数、分数、目标、关卡结束判定、关卡进度管理
import { _decorator, Component, Label, Node, Graphics, Color, resources, JsonAsset } from "cc";
import { BoardController } from "./BoardController";
import { ResultPanel } from "./ResultPanel";
import { TileCell, TileType, TILE_COLORS, TILE_NAMES } from "./TileData";

const { ccclass, property } = _decorator;

export interface LevelConfig {
    levelId:       number;
    maxSteps:      number;
    targetType:    TileType;
    targetCount:   number;
    storyTrigger?: number;
    charId?:       number;
}

export type LevelResult = "win" | "lose" | "playing";

export type AffinityEvent = {
    charId: number;
    delta:  number;
    reason: string;
};

// ─── 好感度规则配置 ─────────────────────────────────────────
// 统一放在顶部，方便你调试数值
const AFFINITY_RULES = {
    perTargetTile:    1,     // 每个目标方块：弱化为 1 点
    chainBonus:       2,     // 触发连锁：+2 点
    clearReward:      5,     // 通关基础奖励：+5 点
    threeStarBonus:   15,    // 三星通关额外奖励：+15 点（强化）
    twoStarBonus:     5,     // 二星通关额外奖励：+5 点
};

@ccclass("GameManager")
export class GameManager extends Component {

    @property(BoardController)
    board!: BoardController;

    @property(Label)
    labelSteps!: Label;

    @property(Label)
    labelScore!: Label;

    @property(Label)
    labelTarget!: Label;

    @property(Node)
    targetIcon: Node = null!;

    @property(Label)
    labelLevel: Label = null!;

    @property(ResultPanel)
    resultPanel: ResultPanel = null!;

    private config!: LevelConfig;
    stepsLeft  = 0;
    score      = 0;
    private eliminated = 0;
    private result: LevelResult = "playing";

    // 本关开始时各角色好感度的快照（用于在结算弹窗显示 +N 的变化）
    private affinityBefore: Record<number, number> = {};
    // 本关好感度变化量（累加，包括通关奖励）
    affinityGainThisLevel = 0;

    private allLevels: LevelConfig[] = [];
    private currentLevelIndex = 0;

    private affinity: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    onLevelEnd: ((result: LevelResult, config: LevelConfig) => void) | null = null;
    onAffinity: ((event: AffinityEvent) => void) | null = null;

    onLoad() {
        this.loadAffinity();
        this.loadLevels();
    }

    private loadLevels() {
        resources.load("LevelConfig", JsonAsset, (err, asset) => {
            if (err) {
                console.error("关卡配置加载失败，使用默认第一关", err);
                this.startLevel(this.getDefaultLevel());
                return;
            }
            this.allLevels = asset.json as LevelConfig[];
            if (!this.allLevels || this.allLevels.length === 0) {
                this.startLevel(this.getDefaultLevel());
                return;
            }

            const savedIndex = this.loadLevelProgress();
            this.currentLevelIndex = Math.min(savedIndex, this.allLevels.length - 1);
            this.startCurrentLevel();
        });
    }

    private getDefaultLevel(): LevelConfig {
        return {
            levelId: 1,
            maxSteps: 25,
            targetType: TileType.Guitar,
            targetCount: 12,
            charId: 0,
        };
    }

    private startCurrentLevel() {
        const config = this.allLevels[this.currentLevelIndex];
        if (!config) return;
        this.startLevel(config);

        if (this.labelLevel) {
            this.labelLevel.string = `第 ${config.levelId} 关`;
        }
    }

    goToNextLevel() {
        this.currentLevelIndex++;
        if (this.currentLevelIndex >= this.allLevels.length) {
            console.log("已到最后一关");
            this.currentLevelIndex = this.allLevels.length - 1;
            return;
        }
        this.saveLevelProgress();
        this.startCurrentLevel();
    }

    retryCurrentLevel() {
        this.startCurrentLevel();
    }

    private saveLevelProgress() {
        try {
            wx.setStorageSync("levelIndex", String(this.currentLevelIndex));
        } catch (e) {}
    }

    private loadLevelProgress(): number {
        try {
            const raw = wx.getStorageSync("levelIndex");
            return raw ? parseInt(raw) : 0;
        } catch (e) {
            return 0;
        }
    }

    startLevel(config: LevelConfig) {
        this.config     = config;
        this.stepsLeft  = config.maxSteps;
        this.score      = 0;
        this.eliminated = 0;
        this.result     = "playing";

        // 记录好感度起点，用于结算时显示 +N
        this.affinityBefore = { ...this.affinity };
        this.affinityGainThisLevel = 0;

        this.board.setCallbacks(
            this.onMatch.bind(this),
            this.onDeadlock.bind(this)
        );
        this.board.resetBoard();
        this.updateUI();
    }

    private onMatch(matched: TileCell[], score: number, isChain: boolean) {
        if (this.result !== "playing") return;

        this.stepsLeft = Math.max(0, this.stepsLeft - 1);

        const chainBonus = isChain ? Math.floor(score * 0.5) : 0;
        this.score += score + chainBonus;

        const targetHit = matched.filter(c => c.type === this.config.targetType).length;
        this.eliminated += targetHit;

        // 弱化的过程好感度：每个目标方块 +1，连锁 +2
        if (targetHit > 0 && this.config.charId !== undefined) {
            const delta = targetHit * AFFINITY_RULES.perTargetTile
                        + (isChain ? AFFINITY_RULES.chainBonus : 0);
            this.addAffinity(this.config.charId, delta, "关卡消除");
        }

        this.updateUI();
        this.checkResult();
    }

    private onDeadlock() {
        console.log("死局，重新洗牌");
        this.board.resetBoard();
    }

    // 星级规则：和 ResultPanel 保持一致
    private calcStars(stepsLeft: number, maxSteps: number): number {
        const ratio = stepsLeft / maxSteps;
        if (ratio >= 1 / 3) return 3;
        if (ratio >= 1 / 5) return 2;
        return 1;
    }

    private checkResult() {
        const won  = this.eliminated >= this.config.targetCount;
        const lost = !won && this.stepsLeft <= 0;

        if (won) {
            this.result = "win";

            if (this.config.charId !== undefined) {
                // 基础通关奖励
                this.addAffinity(this.config.charId, AFFINITY_RULES.clearReward, "关卡通关");

                // 按星级追加奖励（三星给得最多，推动玩家追求高星）
                const stars = this.calcStars(this.stepsLeft, this.config.maxSteps);
                if (stars === 3) {
                    this.addAffinity(this.config.charId, AFFINITY_RULES.threeStarBonus, "三星通关");
                } else if (stars === 2) {
                    this.addAffinity(this.config.charId, AFFINITY_RULES.twoStarBonus, "二星通关");
                }
            }

            this.saveAffinity();
            this.onLevelEnd?.("win", this.config);
            this.showResult("win");

        } else if (lost) {
            this.result = "lose";
            this.onLevelEnd?.("lose", this.config);
            this.showResult("lose");
        }
    }

    private showResult(result: LevelResult) {
        if (!this.resultPanel) {
            console.warn("resultPanel 未绑定");
            return;
        }
        this.resultPanel.show(result, this.config, this.score, this.stepsLeft);
    }

    addAffinity(charId: number, delta: number, reason: string) {
        const oldVal = this.affinity[charId] ?? 0;
        this.affinity[charId] = Math.min(100, Math.max(0, oldVal + delta));
        const actualDelta = this.affinity[charId] - oldVal;
        this.affinityGainThisLevel += actualDelta;
        this.onAffinity?.({ charId, delta: actualDelta, reason });
    }

    getAffinity(charId: number): number {
        return this.affinity[charId] ?? 0;
    }

    // 获取本关该角色好感度涨了多少（给 ResultPanel 用）
    getAffinityGainForChar(charId: number): number {
        const before = this.affinityBefore[charId] ?? 0;
        const now    = this.affinity[charId] ?? 0;
        return now - before;
    }

    checkAffinityUnlock(charId: number): number | null {
        const val = this.getAffinity(charId);
        if (val >= 90) return charId * 10 + 3;
        if (val >= 60) return charId * 10 + 2;
        if (val >= 30) return charId * 10 + 1;
        return null;
    }

    private saveAffinity() {
        try {
            wx.setStorageSync("affinity", JSON.stringify(this.affinity));
            wx.setStorageSync("levelProgress", this.config.levelId);
        } catch (e) {
            console.warn("存档失败", e);
        }
    }

    private loadAffinity() {
        try {
            const raw = wx.getStorageSync("affinity");
            if (raw) this.affinity = JSON.parse(raw);
        } catch (e) {
            console.warn("读档失败，使用默认值");
        }
    }

    private updateUI() {
        if (this.labelSteps)
            this.labelSteps.string = `步数：${this.stepsLeft}`;

        if (this.labelScore)
            this.labelScore.string = `得分：${this.score}`;

        if (this.labelTarget) {
            const remain = Math.max(0, this.config.targetCount - this.eliminated);
            const name = TILE_NAMES[this.config.targetType] ?? "";
            this.labelTarget.string = `消除 ${name} × ${remain}`;
        }

        this.drawTargetIcon();
    }

    private drawTargetIcon() {
        if (!this.targetIcon) return;

        const g = this.targetIcon.getComponent(Graphics);
        if (!g) return;

        const hex = TILE_COLORS[this.config.targetType] ?? "#888888";
        const color = new Color();
        Color.fromHEX(color, hex);

        g.clear();
        g.fillColor = color;
        g.roundRect(-18, -18, 36, 36, 6);
        g.fill();
    }

    watchAdForSteps() {
        const adId = "YOUR_AD_UNIT_ID";
        const ad = wx.createRewardedVideoAd({ adUnitId: adId });

        ad.onClose((res: any) => {
            if (res?.isEnded) {
                this.stepsLeft += 5;
                this.updateUI();
            }
        });
        ad.show().catch(() => {
            console.warn("广告加载失败");
        });
    }
}