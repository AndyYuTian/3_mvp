// ResultPanel.ts
// 关卡结算弹窗
// ResultPanel.ts
// 关卡结算弹窗 - 改进版
// 增强了好感度显示的可靠性

import { _decorator, Component, Node, Label, Button } from "cc";
import { GameManager } from "./GameManager";
import { LevelConfig, LevelResult } from "./GameManager";

const { ccclass, property } = _decorator;

// 角色名字映射
const CHAR_NAMES = ["叶司宸", "林知远", "顾铭川", "方宁朔"];

@ccclass("ResultPanel")
export class ResultPanel extends Component {

    @property(GameManager)
    gameManager!: GameManager;

    @property(Label)
    titleLabel!: Label;

    @property(Label)
    scoreLabel!: Label;

    @property(Label)
    starsLabel!: Label;

    @property(Label)
    affinityLabel: Label = null!;

    @property(Node)
    nextButton!: Node;

    @property(Node)
    retryButton!: Node;

    onLoad() {
        console.log("[ResultPanel] onLoad");
        this.node.active = false;

        this.nextButton?.on(Button.EventType.CLICK, this.onClickNext, this);
        this.retryButton?.on(Button.EventType.CLICK, this.onClickRetry, this);
    }

    show(result: LevelResult, config: LevelConfig, score: number, steps: number) {
        console.log(`[ResultPanel] show: ${result}, score=${score}, steps=${steps}, charId=${config.charId}`);

        this.node.active = true;

        if (result === "win") {
            this.titleLabel.string = "通关！";
            this.nextButton.active = true;
            this.retryButton.active = false;

            const stars = this.calcStars(steps, config.maxSteps);
            this.starsLabel.string = "★".repeat(stars) + "☆".repeat(3 - stars);

            this.showAffinity(config);
        } else {
            this.titleLabel.string = "挑战失败";
            this.nextButton.active = false;
            this.retryButton.active = true;
            this.starsLabel.string = "☆☆☆";

            // 失败也显示好感度（不变），让玩家知道自己的进度
            this.showAffinity(config, false);
        }

        this.scoreLabel.string = `得分 ${score}`;
    }

    // 显示好感度信息
    private showAffinity(config: LevelConfig, gained: boolean = true) {
        if (!this.affinityLabel) {
            console.warn("[ResultPanel] affinityLabel 未绑定");
            return;
        }

        // 没有关联角色时显示提示
        if (config.charId === undefined) {
            this.affinityLabel.node.active = true;
            this.affinityLabel.string = "本关无剧情关联";
            return;
        }

        const name = CHAR_NAMES[config.charId] ?? `角色${config.charId}`;
        const aff = this.gameManager.getAffinity(config.charId);

        this.affinityLabel.node.active = true;
        if (gained) {
            this.affinityLabel.string = `${name}  好感度 ${aff}/100  ↑`;
        } else {
            this.affinityLabel.string = `${name}  好感度 ${aff}/100`;
        }

        console.log(`[ResultPanel] 显示好感度: ${name} = ${aff}`);
    }

    hide() {
        this.node.active = false;
    }
    // 星级规则：剩 1/3 以上 = 3 星；剩 1/5 以上 = 2 星；通关 = 1 星
    private calcStars(stepsLeft: number, maxSteps: number): number {
        const ratio = stepsLeft / maxSteps;
        if (ratio >= 1 / 3) return 3;
        if (ratio >= 1 / 5) return 2;
        return 1;
    }

    private onClickNext() {
        console.log("[ResultPanel] 点击下一关");
        this.hide();
        this.gameManager.goToNextLevel();
    }

    private onClickRetry() {
        console.log("[ResultPanel] 点击重玩");
        this.hide();
        this.gameManager.retryCurrentLevel();
    }
}
