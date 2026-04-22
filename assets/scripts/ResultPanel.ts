// ResultPanel.ts
// 关卡结算弹窗 - 星级动态展示

import { _decorator, Component, Node, Label, Button } from "cc";
import { GameManager } from "./GameManager";
import { LevelConfig, LevelResult } from "./GameManager";
import { StarsDisplay } from "./StarsDisplay";
import { PopupAnimation } from "./PopupAnimation";

const { ccclass, property } = _decorator;

const CHAR_NAMES = ["叶司宸", "林知远", "顾铭川", "方宁朔"];

@ccclass("ResultPanel")
export class ResultPanel extends Component {

    @property(GameManager)
    gameManager!: GameManager;

    @property(Label)
    titleLabel!: Label;

    @property(Label)
    scoreLabel!: Label;

    // 星级显示（新）
    @property(StarsDisplay)
    starsDisplay: StarsDisplay = null!;

    @property(Label)
    affinityLabel: Label = null!;

    @property(Node)
    nextButton!: Node;

    @property(Node)
    retryButton!: Node;

    onLoad() {
        this.node.active = false;
        this.nextButton?.on(Button.EventType.CLICK, this.onClickNext, this);
        this.retryButton?.on(Button.EventType.CLICK, this.onClickRetry, this);
    }

    show(result: LevelResult, config: LevelConfig, score: number, steps: number) {
        this.node.active = true;

        // 弹出动画（如果有 PopupAnimation 组件）
        const popup = this.node.getComponent(PopupAnimation);
        popup?.playShow();

        if (result === "win") {
            this.titleLabel.string = "通关！";
            this.nextButton.active = true;
            this.retryButton.active = false;

            const stars = this.calcStars(steps, config.maxSteps);
            // 交给 StarsDisplay 组件播动画
            this.starsDisplay?.show(stars);

            this.showAffinity(config, true);
        } else {
            this.titleLabel.string = "挑战失败";
            this.nextButton.active = false;
            this.retryButton.active = true;
            this.starsDisplay?.show(0);  // 0 星

            this.showAffinity(config, false);
        }

        this.scoreLabel.string = `得分 ${score}`;
    }

    private showAffinity(config: LevelConfig, won: boolean) {
        if (!this.affinityLabel) return;

        if (config.charId === undefined) {
            this.affinityLabel.node.active = true;
            this.affinityLabel.string = "本关无剧情关联";
            return;
        }

        const name = CHAR_NAMES[config.charId] ?? `角色${config.charId}`;
        const current = this.gameManager.getAffinity(config.charId);
        this.affinityLabel.node.active = true;

        if (won) {
            const gain = this.gameManager.getAffinityGainForChar(config.charId);
            this.affinityLabel.string = `${name}  好感度 ${current}/500  (+${gain})`;
        } else {
            this.affinityLabel.string = `${name}  好感度 ${current}/500`;
        }
    }

    hide() {
        const popup = this.node.getComponent(PopupAnimation);
        if (popup) {
            popup.playHide(() => {
                this.node.active = false;
            });
        } else {
            this.node.active = false;
        }
    }

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
