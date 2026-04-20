// GameManager.ts
// 关卡状态管理器
// 负责：步数、分数、目标、关卡结束判定、关卡进度管理

import { _decorator, Component, Label, Node, resources, JsonAsset } from "cc";
import { BoardController } from "./BoardController";
import { ResultPanel } from "./ResultPanel";
import { TileCell, TileType } from "./TileData";

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

    @property(Label)
    labelLevel: Label = null!;

    @property(ResultPanel)
    resultPanel: ResultPanel = null!;

    private config!: LevelConfig;
    stepsLeft  = 0;
    score      = 0;
    private eliminated = 0;
    private result: LevelResult = "playing";

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
            const delta = targetHit * 2 + (isChain ? 5 : 0);
            this.addAffinity(this.config.charId, delta, "关卡消除");
        }

        this.updateUI();
        this.checkResult();
    }

    private onDeadlock() {
        console.log("死局，重新洗牌");
        this.board.resetBoard();
    }

    private checkResult() {
        const won  = this.eliminated >= this.config.targetCount;
        const lost = !won && this.stepsLeft <= 0;

        if (won) {
            this.result = "win";
            if (this.config.charId !== undefined) {
                this.addAffinity(this.config.charId, 10, "关卡通关");
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
        this.affinity[charId] = Math.min(100,
            Math.max(0, (this.affinity[charId] ?? 0) + delta));
        this.onAffinity?.({ charId, delta, reason });
    }

    getAffinity(charId: number): number {
        return this.affinity[charId] ?? 0;
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
            this.labelTarget.string = `目标：${remain}`;
        }
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
