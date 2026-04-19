// GameManager.ts
// 关卡状态管理器
// 负责：步数、分数、目标、关卡结束判定
// 也是剧情系统和好感度系统的接入口

import { _decorator, Component, Label } from "cc";
import { BoardController } from "./BoardController";
import { TileCell, TileType } from "./TileData";

const { ccclass, property } = _decorator;

// 关卡配置数据结构（从 JSON 读取）
export interface LevelConfig {
    levelId:       number;
    maxSteps:      number;
    targetType:    TileType;    // 需要消除的方块类型
    targetCount:   number;      // 需要消除的数量
    storyTrigger?: number;      // 通关后触发的剧情 ID（可选）
    charId?:       number;      // 触发哪位角色的剧情
}

// 关卡结果
export type LevelResult = "win" | "lose" | "playing";

// 好感度变化事件（供外部监听）
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

    // ─── 关卡状态 ──────────────────────────────────────────────

    private config!: LevelConfig;
    private stepsLeft  = 0;
    private score      = 0;
    private eliminated = 0;   // 目标方块已消除数量
    private result: LevelResult = "playing";

    // 好感度（4 位男主独立存储，持久化）
    private affinity: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    // 外部事件回调
    onLevelEnd: ((result: LevelResult, config: LevelConfig) => void) | null = null;
    onAffinity: ((event: AffinityEvent) => void) | null = null;

    // ─── 初始化 ────────────────────────────────────────────────

    onLoad() {
        this.loadAffinity();
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

    // ─── 消除回调（来自 BoardController）──────────────────────

    private onMatch(matched: TileCell[], score: number, isChain: boolean) {
        if (this.result !== "playing") return;

        // 步数消耗
        this.stepsLeft = Math.max(0, this.stepsLeft - 1);

        // 得分（连锁额外加成）
        const chainBonus = isChain ? Math.floor(score * 0.5) : 0;
        this.score += score + chainBonus;

        // 统计目标方块
        const targetHit = matched.filter(c => c.type === this.config.targetType).length;
        this.eliminated += targetHit;

        // 好感度：消除目标方块时增加关联角色好感
        if (targetHit > 0 && this.config.charId !== undefined) {
            const delta = targetHit * 2 + (isChain ? 5 : 0);
            this.addAffinity(this.config.charId, delta, "关卡消除");
        }

        this.updateUI();
        this.checkResult();
    }

    private onDeadlock() {
        // 死局：自动重新洗牌（不扣步数）
        console.log("死局，重新洗牌");
        this.board.resetBoard();
    }

    // ─── 结果判定 ──────────────────────────────────────────────

    private checkResult() {
        const won  = this.eliminated >= this.config.targetCount;
        const lost = !won && this.stepsLeft <= 0;

        if (won) {
            this.result = "win";
            // 通关好感度奖励
            if (this.config.charId !== undefined) {
                this.addAffinity(this.config.charId, 10, "关卡通关");
            }
            this.saveAffinity();
            this.onLevelEnd?.("win", this.config);

        } else if (lost) {
            this.result = "lose";
            this.onLevelEnd?.("lose", this.config);
        }
    }

    // ─── 好感度系统 ────────────────────────────────────────────

    addAffinity(charId: number, delta: number, reason: string) {
        this.affinity[charId] = Math.min(100,
            Math.max(0, (this.affinity[charId] ?? 0) + delta));
        this.onAffinity?.({ charId, delta, reason });
    }

    getAffinity(charId: number): number {
        return this.affinity[charId] ?? 0;
    }

    // 好感度达到阈值时返回解锁的剧情 ID（供剧情系统查询）
    checkAffinityUnlock(charId: number): number | null {
        const val = this.getAffinity(charId);
        if (val >= 90) return charId * 10 + 3;  // 第三段专属剧情
        if (val >= 60) return charId * 10 + 2;  // 第二段
        if (val >= 30) return charId * 10 + 1;  // 第一段
        return null;
    }

    // ─── 本地存档（微信小游戏 API）────────────────────────────

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

    // ─── UI 更新 ───────────────────────────────────────────────

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

    // ─── 激励广告接口（微信 WAX）──────────────────────────────

    // 看广告换 5 步（在 BoardController 锁定期间不可调用）
    watchAdForSteps() {
        const adId = "YOUR_AD_UNIT_ID"; // 替换为你的广告单元 ID
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
