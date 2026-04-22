// GameManager.ts
// 关卡状态管理器 + 剧情触发
import { _decorator, Component, Label, Node, Graphics, Color, resources, JsonAsset } from "cc";
import { BoardController } from "./BoardController";
import { ResultPanel } from "./ResultPanel";
import { StoryManager } from "./StoryManager";
import { AnimatedLabel } from "./AnimatedLabel";
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

const AFFINITY_RULES = {
    perTargetTile:    1,
    chainBonus:       2,
    clearReward:      5,
    threeStarBonus:   15,
    twoStarBonus:     5,
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

    @property(StoryManager)
    storyManager: StoryManager = null!;

    private config!: LevelConfig;
    stepsLeft  = 0;
    score      = 0;
    private eliminated = 0;
    private result: LevelResult = "playing";

    private affinityBefore: Record<number, number> = {};
    affinityGainThisLevel = 0;

    private allLevels: LevelConfig[] = [];
    private currentLevelIndex = 0;

    private affinity: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    // 记录已看过的剧情，避免重复播放
    private seenStories: Set<number> = new Set();

    onLevelEnd: ((result: LevelResult, config: LevelConfig) => void) | null = null;
    onAffinity: ((event: AffinityEvent) => void) | null = null;

    onLoad() {
        this.loadAffinity();
        this.loadSeenStories();
        this.setupStoryCallback();
        this.loadLevels();
    }

    private setupStoryCallback() {
        if (!this.storyManager) return;
        // 剧情播放完毕后，把选择支带来的好感度加到当前角色上
        this.storyManager.onStoryComplete = (storyId, affinityDelta) => {
            console.log(`[GameManager] 剧情 ${storyId} 结束，好感度 +${affinityDelta}`);
            this.seenStories.add(storyId);
            this.saveSeenStories();

            if (affinityDelta !== 0 && this.config?.charId !== undefined) {
                this.addAffinity(this.config.charId, affinityDelta, "剧情选择");
                this.saveAffinity();
            }

            // 剧情结束后显示结算弹窗
            this.showResult("win");
        };
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
                this.addAffinity(this.config.charId, AFFINITY_RULES.clearReward, "关卡通关");

                const stars = this.calcStars(this.stepsLeft, this.config.maxSteps);
                if (stars === 3) {
                    this.addAffinity(this.config.charId, AFFINITY_RULES.threeStarBonus, "三星通关");
                } else if (stars === 2) {
                    this.addAffinity(this.config.charId, AFFINITY_RULES.twoStarBonus, "二星通关");
                }
            }

            this.saveAffinity();
            this.onLevelEnd?.("win", this.config);

            // 尝试触发剧情，若有剧情则先播剧情后结算；若无剧情直接结算
            if (!this.tryPlayStory()) {
                this.showResult("win");
            }

        } else if (lost) {
            this.result = "lose";
            this.onLevelEnd?.("lose", this.config);
            this.showResult("lose");
        }
    }

    // 尝试播放当前关卡关联的剧情，返回 true 表示已触发
    private tryPlayStory(): boolean {
        if (!this.storyManager) return false;
        if (this.config.storyTrigger === undefined) return false;

        const storyId = this.config.storyTrigger;

        // 已看过的剧情不再重播（避免重玩关卡时烦人）
        if (this.seenStories.has(storyId)) {
            console.log(`[GameManager] 剧情 ${storyId} 已看过，跳过`);
            return false;
        }

        if (!this.storyManager.hasStory(storyId)) {
            console.log(`[GameManager] 剧情 ${storyId} 不存在`);
            return false;
        }

        return this.storyManager.playStory(storyId);
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
        this.affinity[charId] = Math.min(500, Math.max(0, oldVal + delta));
        const actualDelta = this.affinity[charId] - oldVal;
        this.affinityGainThisLevel += actualDelta;
        this.onAffinity?.({ charId, delta: actualDelta, reason });
    }

    getAffinity(charId: number): number {
        return this.affinity[charId] ?? 0;
    }

    getAffinityGainForChar(charId: number): number {
        const before = this.affinityBefore[charId] ?? 0;
        const now    = this.affinity[charId] ?? 0;
        return now - before;
    }

    checkAffinityUnlock(charId: number): number | null {
        const val = this.getAffinity(charId);
        if (val >= 300) return charId * 10 + 3;
        if (val >= 150) return charId * 10 + 2;
        if (val >= 60) return charId * 10 + 1;
        return null;
    }

    private saveAffinity() {
        try {
            wx.setStorageSync("affinity", JSON.stringify(this.affinity));
            wx.setStorageSync("levelProgress", this.config.levelId);
        } catch (e) {}
    }

    private loadAffinity() {
        try {
            const raw = wx.getStorageSync("affinity");
            if (raw) this.affinity = JSON.parse(raw);
        } catch (e) {}
    }

    private saveSeenStories() {
        try {
            const arr = Array.from(this.seenStories);
            wx.setStorageSync("seenStories", JSON.stringify(arr));
        } catch (e) {}
    }

    private loadSeenStories() {
        try {
            const raw = wx.getStorageSync("seenStories");
            if (raw) {
                const arr = JSON.parse(raw) as number[];
                this.seenStories = new Set(arr);
            }
        } catch (e) {}
    }

    private updateUI() {
        if (this.labelSteps)
            this.labelSteps.string = `步数：${this.stepsLeft}`;

        const animLabel = this.labelScore?.node.getComponent(AnimatedLabel);
        if (animLabel) animLabel.animateTo(this.score);
        else if (this.labelScore) this.labelScore.string = `得分：${this.score}`;

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