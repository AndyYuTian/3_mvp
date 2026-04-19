// ResultPanel.ts
// 关卡结算弹窗

import { _decorator, Component, Node, Label, Button } from "cc";
import { GameManager } from "./GameManager";
import { LevelConfig, LevelResult } from "./GameManager";

const { ccclass, property } = _decorator;

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
    affinityLabel!: Label;   // 可选

    @property(Node)
    nextButton!: Node;

    @property(Node)
    retryButton!: Node;

    onLoad() {
        // 默认隐藏
        this.node.active = false;

        // 按钮事件
        this.nextButton?.on(Button.EventType.CLICK, this.onClickNext, this);
        this.retryButton?.on(Button.EventType.CLICK, this.onClickRetry, this);
    }

    // 外部调用：显示结算
    show(result: LevelResult, config: LevelConfig, score: number, steps: number) {
        this.node.active = true;

        if (result === "win") {
            this.titleLabel.string = "通关！";
            this.nextButton.active = true;
            this.retryButton.active = false;

            // 星级：按剩余步数计算
            const stars = this.calcStars(steps, config.maxSteps);
            this.starsLabel.string = "★".repeat(stars) + "☆".repeat(3 - stars);

            // 好感度变化提示（如果有关联角色）
            if (config.charId !== undefined && this.affinityLabel) {
                const names = ["叶司宸", "林知远", "顾铭川", "方宁朔"];
                const aff = this.gameManager.getAffinity(config.charId);
                this.affinityLabel.string = `${names[config.charId]} 好感 ${aff}`;
                this.affinityLabel.node.active = true;
            } else if (this.affinityLabel) {
                this.affinityLabel.node.active = false;
            }
        } else {
            this.titleLabel.string = "挑战失败";
            this.nextButton.active = false;
            this.retryButton.active = true;
            this.starsLabel.string = "☆☆☆";
            if (this.affinityLabel) this.affinityLabel.node.active = false;
        }

        this.scoreLabel.string = `得分 ${score}`;
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
        this.hide();
        this.gameManager.goToNextLevel();
    }

    private onClickRetry() {
        this.hide();
        this.gameManager.retryCurrentLevel();
    }
}
